/**
 * La mitad de servidor del adaptador de Neon.
 *
 * Dos piezas, las dos sobre `@neondatabase/auth/server`, que es la cara del SDK
 * que NO está atada a ningún framework:
 *
 *   · `authRoute`, el proxy a Managed Better Auth que monta
 *     `app/api/auth/[...path]/route.ts`. Es lo que hace que la sesión sea una
 *     cookie httpOnly de primera parte.
 *   · `session`, el guardia que `proxy.ts` consulta en cada petición.
 *
 * `handleAuthProxyRequest` y `processAuthMiddleware` reciben un `Request` estándar
 * y devuelven una `Response` o una decisión. Por eso ni `NextResponse` ni
 * `next/headers` aparecen aquí: el subpath `@neondatabase/auth/next/server` los
 * arrastraría, y con ellos la imposibilidad de probar el guardia fuera de un
 * servidor de Next.
 *
 * El `neonAuthMiddleware` que el SDK trae hecho tampoco se usa: protege todo lo
 * que no esté en SU lista de exclusiones, y la lista de públicas es de la app.
 */

import {
  DEFAULT_AUTH_SKIP_ROUTES,
  NEON_AUTH_SESSION_DATA_COOKIE_NAME,
  handleAuthProxyRequest,
  parseCookieValue,
  processAuthMiddleware,
  validateSessionData,
} from "@neondatabase/auth/server";

import { NEON_SETUP_HINT } from "@/lib/backend/adapters/neon/client";
import { createNeonDataClient } from "@/lib/backend/adapters/neon/data";
import { createNeonRowStore } from "@/lib/backend/adapters/neon/store";
import { createTokenSource, neonTokenFetcher } from "@/lib/backend/adapters/neon/token";
import { createRepositories } from "@/lib/backend/adapters/postgrest/kernel";
import { mergeSetCookies } from "@/lib/backend/cookies";
import { requireEnv } from "@/lib/backend/env";
import { canAct, UnauthenticatedError } from "@/lib/backend/ports";
import type {
  AuthRoute,
  AuthSession,
  ServerData,
  SessionGate,
  SessionGuard,
  ServerBackendProvider,
} from "@/lib/backend/ports";

export const NEON_SERVER_ENV_KEYS = {
  authUrl: "NEON_AUTH_URL",
  cookieSecret: "NEON_AUTH_COOKIE_SECRET",
} as const;

const SECRET_HINT =
  "Genérala con `openssl rand -base64 32` (mínimo 32 caracteres) y ponla también en Vercel.";

type NeonServerConfig = {
  readonly baseUrl: string;
  readonly cookieSecret: string;
};

/**
 * @throws MissingEnvError si falta cualquiera de las dos. Falla en vez de
 * degradar a propósito: sin secreto no hay cookie firmada, y sin cookie firmada
 * el guardia dejaría pasar a cualquiera.
 */
function readConfig(): NeonServerConfig {
  return {
    baseUrl: requireEnv(
      NEON_SERVER_ENV_KEYS.authUrl,
      process.env.NEON_AUTH_URL,
      NEON_SETUP_HINT,
    ),
    cookieSecret: requireEnv(
      NEON_SERVER_ENV_KEYS.cookieSecret,
      process.env.NEON_AUTH_COOKIE_SECRET,
      SECRET_HINT,
    ),
  };
}

/**
 * El parámetro con el que Managed Better Auth devuelve al usuario tras un login
 * social. El SDK no lo exporta, así que el literal vive aquí: es exactamente el
 * tipo de detalle que un adaptador existe para absorber.
 */
const OAUTH_VERIFIER_PARAM = "neon_auth_session_verifier";

/** El usuario de Better Auth, reducido a lo que el puerto expone. */
type SessionDataUser = {
  id?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  name?: unknown;
  image?: unknown;
};

/** Lo que venga de la cookie solo pasa si es texto; cualquier otra cosa, `null`. */
function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toAuthSession(user: SessionDataUser): AuthSession | null {
  if (typeof user.id !== "string" || typeof user.email !== "string")
    return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified === true,
      name: optionalText(user.name),
      image: optionalText(user.image),
    },
  };
}

function createNeonSessionGuard(config: NeonServerConfig): SessionGuard {
  const guard: SessionGuard = {
    needsGateOnPublicPath(request) {
      return new URL(request.url).searchParams.has(OAUTH_VERIFIER_PARAM);
    },

    async sessionFor(headers) {
      // Se lee la cookie de sesión que este servidor firmó, y no se pregunta al
      // proveedor: es la comprobación optimista que la documentación de Next
      // pide, y la que evita una llamada de red por render. Quien la siembra y
      // la refresca es `gate`, que corre antes en el proxy.
      try {
        const raw = headers.get("cookie");
        if (!raw) return null;
        const cookie = parseCookieValue(
          raw,
          NEON_AUTH_SESSION_DATA_COOKIE_NAME,
        );
        if (!cookie) return null;

        const result = await validateSessionData(cookie, config.cookieSecret);
        if (!result.valid || !result.payload?.user) return null;
        return toAuthSession(result.payload.user as SessionDataUser);
      } catch {
        // El puerto promete que esto no lanza: sin sesión legible, no hay sesión.
        return null;
      }
    },

    async gate(request, { loginUrl, publicPaths }): Promise<SessionGate> {
      const result = await processAuthMiddleware({
        request,
        pathname: new URL(request.url).pathname,
        // Las públicas de la app, más las que el SDK necesita libres para
        // completar sus propios flujos. Se componen en vez de sustituirse:
        // quitar una de las del SDK rompería el intercambio de OAuth.
        skipRoutes: [...new Set([...DEFAULT_AUTH_SKIP_ROUTES, ...publicPaths])],
        loginUrl,
        baseUrl: config.baseUrl,
        cookieSecret: config.cookieSecret,
      });

      if (result.action === "allow") {
        const setCookies = result.cookies ?? [];

        // `processAuthMiddleware` solo pregunta si HAY sesión, y eso no basta:
        // el spec exige el email confirmado. Se relee sobre las cookies que
        // acaba de mintear, porque las nuevas van en la respuesta y todavía no
        // están en la petición.
        //
        // Solo se rechaza una sesión que EXISTE y no puede actuar: cuando no hay
        // ninguna, el `allow` viene de una ruta pública y no hay nada que negar.
        const session = await guard.sessionFor(
          mergeSetCookies(request.headers, setCookies),
        );
        if (session !== null && !canAct(session)) {
          return { kind: "redirect", to: loginUrl, setCookies };
        }

        return {
          kind: "allow",
          setCookies,
          requestHeaders: result.headers ?? {},
        };
      }

      // Las otras dos decisiones son redirects, y una de ellas es la vuelta de
      // Google: el proveedor devuelve al usuario con un verificador en la query,
      // el SDK lo canjea por la cookie de sesión y manda a la misma URL ya
      // limpia. Sin ese caso, entrar con Google terminaba sin sesión.
      return {
        kind: "redirect",
        to: result.redirectUrl.toString(),
        setCookies: result.cookies ?? [],
      };
    },
  };

  return guard;
}

/**
 * El proxy a Managed Better Auth.
 *
 * `handleAuthProxyRequest` es la primitiva agnóstica del SDK: reenvía ruta,
 * cuerpo y cookies tal cual, y de vuelta reescribe las cookies como de primera
 * parte y mintea la de datos de sesión. No hace falta envolverla en nada.
 */
function createNeonAuthRoute(config: NeonServerConfig): AuthRoute {
  return {
    handle: (request, path) =>
      handleAuthProxyRequest({
        request,
        path,
        baseUrl: config.baseUrl,
        cookieSecret: config.cookieSecret,
      }),
  };
}

/**
 * Los repositorios de Neon, atados a la sesión de cada petición.
 *
 * Aquí es donde el ADR 0006 se cumple o se incumple, así que conviene decirlo
 * en voz alta: el cliente se construye con el JWT DEL USUARIO. No hay
 * `DATABASE_URL` en este archivo y no puede haberla — ese rol tiene BYPASSRLS,
 * y con él la autorización dejaría de estar en las políticas del motor para
 * pasar a depender de que ninguna de las veintitrés operaciones se olvide de un
 * `where`. Las políticas del ADR 0001 quedarían de adorno.
 *
 * El `TokenSource` se crea UNA vez por adaptador y los repositorios UNA vez por
 * petición. Es el reparto correcto: lo que se comparte es la caché —cuya clave
 * es la cookie, así que un token solo vuelve a quien lo consiguió— y lo que
 * nunca se comparte es el cliente, que lleva dentro la identidad de quien
 * pregunta.
 */
function createNeonServerData(config: NeonServerConfig): ServerData {
  const tokens = createTokenSource(neonTokenFetcher(config));

  return {
    async repositoriesFor(request) {
      // Se pide el token AQUÍ y no perezosamente dentro de la consulta: sin
      // sesión, esto es un `UnauthenticatedError` inmediato en vez de un viaje
      // al motor que vuelve con un 401 traducido. Es la misma respuesta, un
      // salto antes.
      if ((await tokens.tokenFor(request)) === null) {
        throw new UnauthenticatedError();
      }

      const client = createNeonDataClient(
        () => tokens.tokenFor(request),
        () => tokens.forget(request),
      );
      return createRepositories(createNeonRowStore(client));
    },
  };
}

export function createNeonServerBackend(): ServerBackendProvider {
  const config = readConfig();
  return {
    name: "neon",
    session: createNeonSessionGuard(config),
    authRoute: createNeonAuthRoute(config),
    data: createNeonServerData(config),
  };
}
