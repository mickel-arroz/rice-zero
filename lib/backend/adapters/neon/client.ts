/**
 * El cliente de Neon, uno por pestaña. Dos mitades, y no una.
 *
 * **Auth** va contra `/api/auth`, una ruta de ESTA aplicación que proxea a
 * Managed Better Auth (`app/api/auth/[...path]/route.ts`). Ese salto no es
 * decorativo: es lo que convierte la sesión en una cookie httpOnly de PRIMERA
 * parte, y una cookie de primera parte es la única que `proxy.ts` puede leer.
 * Hablando directo con el origen de Neon, la cookie era de otro dominio y el
 * servidor no podía ver la sesión de nadie.
 *
 * **Data API** sigue siendo directo, como decide el ADR 0001: el navegador habla
 * con PostgREST y la autorización vive en las políticas RLS, que el motor evalúa
 * contra el JWT. Lo que cambia es de dónde sale el JWT — de `getToken`, que lo
 * pide a la sesión que ahora vive en nuestra cookie.
 *
 * Es perezoso y memoizado: se construye la primera vez que alguien lo pide, no
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
 */

import {
  createAuthClient,
  type VanillaBetterAuthClient,
} from "@neondatabase/auth";
import { createClient, type NeonPostgrestClient } from "@neondatabase/neon-js";

import { requireEnv } from "@/lib/backend/env";
import type { Database } from "@/lib/backend/adapters/neon/database.types";
import { AUTH_ROUTE_MOUNT } from "@/lib/backend/ports";

export const NEON_ENV_KEYS = {
  dataApiUrl: "NEXT_PUBLIC_NEON_DATA_API_URL",
  /**
   * El origen de Managed Better Auth. Ya NO es `NEXT_PUBLIC_`: desde que el
   * navegador habla con `/api/auth`, quien necesita esta URL es el servidor.
   */
  authUrl: "NEON_AUTH_URL",
} as const;

const SETUP_HINT =
  "Ejecuta `bash scripts/setup-neon.sh` para generar .env.local.";

export type NeonBrowserClient = {
  /** El cliente Better Auth, apuntado a nuestra ruta. */
  readonly auth: VanillaBetterAuthClient;
  /** El Data API, con el JWT de la sesión inyectado en cada petición. */
  readonly data: NeonPostgrestClient<Database>;
  /**
   * El JWT que el Data API verifica contra el JWKS, o `null` sin sesión.
   *
   * Se expone —en vez de quedarse dentro de `getToken`— para que una corrida en
   * vivo pueda comprobar que lo que sale de aquí es un JWT de verdad. Es la
   * única forma de probarlo: el fallo que lo motivó no se veía ni en el
   * typecheck ni contra el adaptador en memoria.
   */
  accessToken(): Promise<string | null>;
  /** Olvida el JWT cacheado. Lo llama el proveedor al entrar y al salir. */
  forgetToken(): void;
};

/**
 * A dónde apunta el cliente de auth.
 *
 * En el navegador SIEMPRE a `/api/auth`, absoluta sobre el origen actual para no
 * depender de cómo resuelva Better Auth una ruta relativa.
 *
 * Fuera del navegador no hay origen que resolver, así que se usa el servicio
 * directamente. Eso es lo que hace la corrida en vivo
 * (`npm run test:contract:live`), donde no hay servidor de Next que montar. NO es
 * una ruta alternativa de producción: `authApiHandler` reenvía ruta, cuerpo y
 * cookies tal cual, así que el contrato entre el SDK y el proveedor —lo único que
 * la corrida en vivo puede probar— es el mismo a los dos lados del proxy. Lo que
 * la corrida NO cubre es el salto por nuestra ruta.
 */
function resolveAuthUrl(): string {
  if (typeof window !== "undefined") {
    return new URL(AUTH_ROUTE_MOUNT, window.location.origin).toString();
  }
  return requireEnv(
    NEON_ENV_KEYS.authUrl,
    process.env.NEON_AUTH_URL,
    SETUP_HINT,
  );
}

/**
 * El endpoint del plugin JWT de Better Auth, bajo el punto de montaje de auth.
 *
 * ES OTRO token que el de la sesión, y confundirlos costó una tarde: el Data
 * API rechazaba TODA lectura con «Provided authentication token is not a valid
 * JWT encoding» mientras el login funcionaba perfectamente.
 *
 * `getJWTToken()` del propio SDK lee `session.token`, y eso funciona cuando el
 * navegador habla DIRECTO con Managed Better Auth. Detrás de nuestro proxy de
 * primera parte (ADR 0002) no: por ahí `get-session` devuelve el token OPACO de
 * 32 caracteres —con caché o sin ella, da igual `disableCookieCache`—, que no
 * es un JWT y que el motor no puede verificar. El JWT solo sale de `/token`.
 */
const TOKEN_ENDPOINT = "token";

/** Cuánto antes de que caduque se pide otro. Un minuto de margen. */
const TOKEN_MARGIN_MS = 60_000;

/** Sin `exp` legible no se adivina: se guarda un minuto y se vuelve a pedir. */
const TOKEN_FALLBACK_MS = 60_000;

/**
 * Cuándo caduca este JWT, en milisegundos de época.
 *
 * Se lee la carga útil, que en un JWT va en claro y es pública por definición:
 * no se está verificando nada aquí —de eso se encarga el motor contra el
 * JWKS—, solo se mira hasta cuándo vale para no pedir otro en cada consulta.
 */
function expiryOf(jwt: string): number | null {
  const payload = jwt.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

function buildClient(): NeonBrowserClient {
  // Literal a propósito: Next incrusta los `NEXT_PUBLIC_*` en tiempo de build
  // sustituyendo el texto, así que un acceso indirecto no se sustituye.
  const dataApiUrl = requireEnv(
    NEON_ENV_KEYS.dataApiUrl,
    process.env.NEXT_PUBLIC_NEON_DATA_API_URL,
    SETUP_HINT,
  );

  const authUrl = resolveAuthUrl();
  const auth = createAuthClient(authUrl);

  /**
   * El JWT vigente, mientras lo sea.
   *
   * Se cachea porque `getToken` corre en CADA consulta al Data API, y sin caché
   * cada lista de Proyectos costaría dos viajes en vez de uno. Se olvida al
   * entrar y al salir —no solo al caducar— porque un JWT del usuario anterior
   * serviría para leer sus datos: la caducidad es una optimización, el olvido
   * es la garantía.
   */
  let cached: { token: string; until: number } | null = null;

  async function accessToken(): Promise<string | null> {
    if (cached && Date.now() < cached.until) return cached.token;

    // Por `fetch` y no por el SDK: el cliente vanilla no expone este endpoint,
    // y la petición no tiene nada de particular — misma ruta, mismas cookies.
    const response = await fetch(`${authUrl}/${TOKEN_ENDPOINT}`, {
      credentials: "include",
    });
    // Sin sesión el proveedor contesta 401. `null` y no un throw: el store lo
    // traduce a `UnauthenticatedError` en vez de salir a la red sin token.
    if (!response.ok) return null;

    const body = (await response.json()) as { token?: unknown };
    if (typeof body.token !== "string" || body.token.length === 0) return null;

    const expiry = expiryOf(body.token);
    cached = {
      token: body.token,
      until: expiry
        ? expiry - TOKEN_MARGIN_MS
        : Date.now() + TOKEN_FALLBACK_MS,
    };
    return cached.token;
  }

  const data = createClient<Database>({
    dataApi: {
      url: dataApiUrl,
      getToken: accessToken,
    },
  });

  return {
    auth,
    data,
    accessToken,
    forgetToken: () => {
      cached = null;
    },
  };
}

let client: NeonBrowserClient | null = null;

export function getNeonClient(): NeonBrowserClient {
  if (client) return client;
  client = buildClient();
  return client;
}

/** Solo para tests: obliga a reconstruir el cliente memoizado. */
export function resetNeonClient(): void {
  client = null;
}

/** El texto que el wizard de Neon genera. Lo comparte la mitad de servidor. */
export const NEON_SETUP_HINT = SETUP_HINT;
