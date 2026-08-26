import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Cliente de Supabase para el navegador, uno por pestaña.
 *
 * Es perezoso y memoizado: se construye la primera vez que alguien lo pide,
 * no al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad se necesite hablar con Supabase.
 *
 * Solo la capa de servicios debe llamarlo.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (client) return client;

  const { url, publishableKey } = readSupabasePublicEnv();
  client = createBrowserClient<Database>(url, publishableKey);
  return client;
}
