/**
 * El JWT del usuario, conseguido desde el SERVIDOR.
 *
 * Es la pieza que sostiene todo el ADR 0006: mientras el token que llega al Data
 * API sea el del usuario, la autorización sigue siendo RLS y este proyecto no ha
 * movido su modelo de seguridad, solo el sitio desde donde se habla.
 *
 * ── De dónde sale ─────────────────────────────────────────────────────────
 *
 * Del endpoint `/token` del plugin JWT de Better Auth, que es exactamente de
 * donde salía en el navegador. Y se pide reutilizando `handleAuthProxyRequest`,
 * la misma primitiva que monta `authRoute` — no con un `fetch` a mano.
 *
 * La diferencia importa: nuestras cookies son de PRIMERA parte (ADR 0002), y
 * `prepareRequestHeaders` del SDK las traduce con `extractNeonAuthCookies` a lo
 * que el proveedor entiende. Un `fetch` propio reenviando `cookie` tal cual
 * obligaría a reimplementar esa traducción y el nombre de la cookie, que son
 * detalle del proveedor y del SDK: justo lo que un adaptador existe para
 * absorber.
 *
 * Y NO se usa `getJWTToken()` del SDK: detrás de nuestro proxy devuelve el token
 * OPACO de 32 caracteres, que no es un JWT y que el motor rechaza con «Provided
 * authentication token is not a valid JWT encoding». Está documentado en
 * `client.ts` y costó una tarde; no hay que redescubrirlo.
 */

import {
  handleAuthProxyRequest,
  NEON_AUTH_SESSION_COOKIE_NAME,
  parseCookieValue,
} from "@neondatabase/auth/server";

import { AUTH_ROUTE_MOUNT } from "@/lib/backend/ports";

/** El endpoint del plugin JWT, bajo el punto de montaje de auth. */
const TOKEN_PATH = "token";

/** Cuánto antes de que caduque se pide otro. Un minuto de margen. */
export const TOKEN_MARGIN_MS = 60_000;

/** Sin `exp` legible no se adivina: se guarda un minuto y se vuelve a pedir. */
export const TOKEN_FALLBACK_MS = 60_000;

export type TokenConfig = {
  readonly baseUrl: string;
  readonly cookieSecret: string;
};

/**
 * Cuándo caduca este JWT, en milisegundos de época.
 *
 * Se lee la carga útil, que en un JWT va en claro y es pública por definición:
 * no se está verificando nada —de eso se encarga el motor contra el JWKS—, solo
 * se mira hasta cuándo vale para no pedir otro en cada consulta.
 *
 * `Buffer` y no `atob` porque esto corre en Node: `atob` existe, pero `Buffer`
 * es lo que el resto del servidor usa y no depende de un global de navegador.
 */
export function expiryOf(jwt: string): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Las cabeceras que el proxy necesita ver, y solo ésas.
 *
 * `origin` va porque Managed Better Auth contesta `403 Missing or null Origin`
 * sin él. NO se reenvía `content-type`: la petición sintética es un GET sin
 * cuerpo, y anunciar un tipo que no se manda confunde al proveedor.
 */
function forwardedHeaders(source: Headers, origin: string): Headers {
  const headers = new Headers();
  const cookie = source.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  headers.set("origin", source.get("origin") ?? origin);
  const agent = source.get("user-agent");
  if (agent) headers.set("user-agent", agent);
  return headers;
}

/**
 * Pide un JWT nuevo al proveedor, sin caché de por medio.
 *
 * @returns `null` sin sesión. El proveedor contesta 401 y eso no es un fallo:
 *   es la respuesta. Quien llama lo traduce a `UnauthenticatedError`.
 */
async function fetchToken(
  config: TokenConfig,
  request: Request,
): Promise<string | null> {
  const origin = new URL(request.url).origin;
  const response = await handleAuthProxyRequest({
    request: new Request(new URL(`${AUTH_ROUTE_MOUNT}/${TOKEN_PATH}`, origin), {
      method: "GET",
      headers: forwardedHeaders(request.headers, origin),
    }),
    path: TOKEN_PATH,
    baseUrl: config.baseUrl,
    cookieSecret: config.cookieSecret,
  });

  if (!response.ok) return null;

  const body = (await response.json()) as { token?: unknown };
  return typeof body.token === "string" && body.token.length > 0
    ? body.token
    : null;
}

type CachedToken = { readonly token: string; readonly until: number };

/** Cuántas sesiones distintas se recuerdan como mucho. */
export const TOKEN_CACHE_MAX = 256;

/** De dónde sale un token cuando el caché no lo tiene. */
export type TokenFetcher = (request: Request) => Promise<string | null>;

export type TokenSource = {
  /** El JWT de esta petición. `null` cuando no hay sesión. */
  tokenFor(request: Request): Promise<string | null>;
  /** Olvida el de esta petición. Lo llama el reintento del tropiezo del #41. */
  forget(request: Request): void;
};

/** La cookie de sesión de esta petición, que es la clave de todo lo de abajo. */
function sessionKeyOf(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  return parseCookieValue(cookie, NEON_AUTH_SESSION_COOKIE_NAME);
}

/**
 * Los tokens vigentes, por COOKIE DE SESIÓN y nunca por id de usuario.
 *
 * La clave es lo que hace segura esta caché, así que no es un detalle: un token
 * cacheado solo se le entrega a quien presenta la misma cookie que lo consiguió.
 * Con el id de usuario como clave habría que acordarse de invalidar al cerrar
 * sesión desde un sitio que ya no puede avisar —el navegador no alcanza la
 * memoria del servidor—, y olvidarlo significaría servirle a la sesión nueva el
 * token de la vieja.
 *
 * Es una FÁBRICA y no un mapa de módulo para que se pueda probar con un doble
 * que cuente llamadas, que es lo único que demuestra que el caché ahorra
 * viajes. Vive dentro del adaptador de servidor, que `getServerBackend()` ya
 * memoiza: en la práctica hay uno por instancia, que es lo que se quería.
 */
export function createTokenSource(fetchToken: TokenFetcher): TokenSource {
  const tokens = new Map<string, CachedToken>();

  /**
   * Las peticiones en vuelo, para que dos consultas simultáneas pidan un token
   * y no dos. Pasa de verdad y en el primer render: los providers cargan a la
   * vez, y React en modo estricto monta los efectos dos veces.
   */
  const inFlight = new Map<string, Promise<string | null>>();

  /**
   * Guarda un token recién conseguido.
   *
   * La entrada vale hasta un minuto ANTES del `exp` del propio JWT. El margen no
   * es prudencia genérica: sin él, una consulta puede salir con un token que
   * caduca en vuelo y el motor la rechaza por algo que el caché sabía. Cuando el
   * `exp` no se puede leer no se adivina —se guarda un minuto y se vuelve a
   * preguntar—, que es lo mismo que hacía el navegador.
   *
   * El tope se aplica podando primero lo ya caducado y desalojando solo si
   * después sigue lleno. Ese orden importa: la clave es la cookie de sesión, así
   * que lo que llena el mapa en una instancia larga son sesiones que terminaron,
   * no usuarios activos compitiendo. Desalojar sin podar echaría a alguien que
   * está trabajando para hacerle sitio a la basura de otro. `Map` conserva el
   * orden de inserción, así que el desalojo se lleva la más vieja.
   */
  function remember(key: string, token: string): void {
    const expiry = expiryOf(token);
    const until = expiry
      ? expiry - TOKEN_MARGIN_MS
      : Date.now() + TOKEN_FALLBACK_MS;

    if (tokens.size >= TOKEN_CACHE_MAX) {
      const now = Date.now();
      for (const [cached, entry] of tokens) {
        if (now >= entry.until) tokens.delete(cached);
      }
      // Si la poda no liberó nada, todas están vivas y hay que echar a alguien.
      // La más vieja es la que más cerca está de caducar sola.
      if (tokens.size >= TOKEN_CACHE_MAX) {
        const oldest = tokens.keys().next();
        if (!oldest.done) tokens.delete(oldest.value);
      }
    }

    tokens.set(key, { token, until });
  }

  return {
    async tokenFor(request) {
      const key = sessionKeyOf(request);
      // Sin cookie de sesión no hay nada que preguntarle al proveedor:
      // contestaría 401. Se ahorra el viaje y se contesta lo mismo.
      if (!key) return null;

      const hit = tokens.get(key);
      if (hit && Date.now() < hit.until) return hit.token;

      const pending =
        inFlight.get(key) ??
        fetchToken(request)
          .then((token) => {
            if (token) remember(key, token);
            return token;
          })
          .finally(() => {
            inFlight.delete(key);
          });

      inFlight.set(key, pending);
      return pending;
    },

    forget(request) {
      const key = sessionKeyOf(request);
      if (!key) return;
      tokens.delete(key);
      inFlight.delete(key);
    },
  };
}

/** El fetcher de verdad: `fetchToken` atado a la configuración del adaptador. */
export function neonTokenFetcher(config: TokenConfig): TokenFetcher {
  return (request) => fetchToken(config, request);
}
