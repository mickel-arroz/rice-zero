/**
 * El cliente de Neon, uno por pestaña.
 *
 * `createClient` de `@neondatabase/neon-js` junta las dos mitades del
 * proveedor: Managed Better Auth firma el JWT y el Data API (PostgREST) lo
 * recibe en cada petición. El navegador habla DIRECTO con el Data API; la
 * autorización vive en las políticas RLS, que el motor evalúa contra el JWT
 * después de que `pg_session_jwt` verifique la firma contra el JWKS público.
 *
 * Es perezoso y memoizado: se construye la primera vez que alguien lo pide, no
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
 */

import { createClient } from "@neondatabase/neon-js";

import { requireEnv } from "@/lib/backend/env";
import type { Database } from "@/lib/backend/adapters/neon/database.types";

export const NEON_ENV_KEYS = {
  dataApiUrl: "NEXT_PUBLIC_NEON_DATA_API_URL",
  authUrl: "NEXT_PUBLIC_NEON_AUTH_URL",
} as const;

const SETUP_HINT = "Ejecuta `bash scripts/setup-neon.sh` para generar .env.local.";

export type NeonBrowserClient = ReturnType<typeof buildClient>;

function buildClient(dataApiUrl: string, authUrl: string) {
  return createClient<Database>({
    auth: { url: authUrl },
    dataApi: { url: dataApiUrl },
  });
}

let client: NeonBrowserClient | null = null;

export function getNeonClient(): NeonBrowserClient {
  if (client) return client;

  // Literales a propósito: Next incrusta los `NEXT_PUBLIC_*` en tiempo de
  // build sustituyendo el texto, así que un acceso indirecto no se sustituye.
  const dataApiUrl = requireEnv(
    NEON_ENV_KEYS.dataApiUrl,
    process.env.NEXT_PUBLIC_NEON_DATA_API_URL,
    SETUP_HINT,
  );
  const authUrl = requireEnv(
    NEON_ENV_KEYS.authUrl,
    process.env.NEXT_PUBLIC_NEON_AUTH_URL,
    SETUP_HINT,
  );

  client = buildClient(dataApiUrl, authUrl);
  return client;
}

/** Solo para tests: obliga a reconstruir el cliente memoizado. */
export function resetNeonClient(): void {
  client = null;
}
