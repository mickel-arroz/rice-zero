/**
 * El cliente de Neon en el navegador, uno por pestaña. Ya solo auth.
 *
 * **Auth** va contra `/api/auth`, una ruta de ESTA aplicación que proxea a
 * Managed Better Auth (`app/api/auth/[...path]/route.ts`). Ese salto no es
 * decorativo: es lo que convierte la sesión en una cookie httpOnly de PRIMERA
 * parte, y una cookie de primera parte es la única que `proxy.ts` puede leer.
 * Hablando directo con el origen de Neon, la cookie era de otro dominio y el
 * servidor no podía ver la sesión de nadie.
 *
 * **Aquí vivía la mitad de datos**: un cliente PostgREST contra
 * `NEXT_PUBLIC_NEON_DATA_API_URL`, con el JWT inyectado en cada consulta y
 * cacheado hasta su `exp`. Se la llevó el ADR 0006. Ahora quien habla con el
 * Data API es el servidor (`adapters/neon/data.ts` y `token.ts`), y el navegador
 * solo ve `/api/*`.
 *
 * Con ella se fueron `accessToken` y `forgetToken`, y esa desaparición ES la
 * ganancia principal del ADR: en el navegador ya no hay ningún token que un XSS
 * pueda llevarse ni del que nadie tenga que acordarse de olvidar.
 *
 * Es perezoso y memoizado: se construye la primera vez que alguien lo pide, no
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
 */

import {
  createAuthClient,
  type VanillaBetterAuthClient,
} from "@neondatabase/auth";

import { requireEnv } from "@/lib/backend/env";
import { AUTH_ROUTE_MOUNT } from "@/lib/backend/ports";

export const NEON_ENV_KEYS = {
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

/*
 * Aquí vivían `TOKEN_ENDPOINT`, el margen de caducidad y `expiryOf`, que el
 * navegador necesitaba para cachear el JWT del Data API. Se mudaron enteros a
 * `adapters/neon/token.ts` con el ADR 0006, junto con la advertencia que costó
 * una tarde: el JWT solo sale de `/token`, y `getJWTToken()` del SDK devuelve
 * otra cosa detrás de nuestro proxy.
 */

function buildClient(): NeonBrowserClient {
  const authUrl = resolveAuthUrl();
  const auth = createAuthClient(authUrl);

  return { auth };
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
