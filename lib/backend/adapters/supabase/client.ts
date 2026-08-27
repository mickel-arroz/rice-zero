/**
 * El cliente de Supabase, uno por pestaña.
 *
 * El navegador habla DIRECTO con PostgREST: la autorización vive en las
 * políticas RLS, que el motor evalúa contra el JWT, no en la clave. Por eso la
 * clave publicable es pública por diseño.
 *
 * Es perezoso y memoizado: se construye la primera vez que alguien lo pide, no
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireEnv } from "@/lib/backend/env";
import type { Database } from "@/lib/backend/adapters/supabase/database.types";

export const SUPABASE_ENV_KEYS = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

const SETUP_HINT = "Ejecuta `bash scripts/setup-supabase.sh` para generar .env.local.";

export type SupabaseBrowserClient = SupabaseClient<Database>;

let client: SupabaseBrowserClient | null = null;

export function getSupabaseClient(): SupabaseBrowserClient {
  if (client) return client;

  // Literales a propósito: Next incrusta los `NEXT_PUBLIC_*` en tiempo de
  // build sustituyendo el texto, así que un acceso indirecto no se sustituye.
  const url = requireEnv(
    SUPABASE_ENV_KEYS.url,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    SETUP_HINT,
  );
  const publishableKey = requireEnv(
    SUPABASE_ENV_KEYS.publishableKey,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SETUP_HINT,
  );

  client = createBrowserClient<Database>(url, publishableKey);
  return client;
}

/** Solo para tests: obliga a reconstruir el cliente memoizado. */
export function resetSupabaseClient(): void {
  client = null;
}
