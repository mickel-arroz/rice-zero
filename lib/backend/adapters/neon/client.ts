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

function buildClient(): NeonBrowserClient {
  // Literal a propósito: Next incrusta los `NEXT_PUBLIC_*` en tiempo de build
  // sustituyendo el texto, así que un acceso indirecto no se sustituye.
  const dataApiUrl = requireEnv(
    NEON_ENV_KEYS.dataApiUrl,
    process.env.NEXT_PUBLIC_NEON_DATA_API_URL,
    SETUP_HINT,
  );

  const auth = createAuthClient(resolveAuthUrl());

  const data = createClient<Database>({
    dataApi: {
      url: dataApiUrl,
      /**
       * El JWT que el Data API verifica contra el JWKS. Sale de la sesión, y la
       * sesión sale de nuestra cookie a través de `/api/auth/get-session`, que
       * el SDK ya cachea 60 s por su cuenta.
       *
       * `null` cuando no hay sesión: el store lo traduce a
       * `UnauthenticatedError` en vez de salir a la red sin token.
       */
      getToken: async () => {
        const { data: session } = await auth.getSession();
        return session?.session?.token ?? null;
      },
    },
  });

  return { auth, data };
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
