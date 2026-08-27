/**
 * El adaptador de Supabase. Dormido pero compilando.
 *
 * El interruptor (`NEXT_PUBLIC_BACKEND`) apunta a Neon; esto existe para que
 * volver sea cambiar la variable y redesplegar, no reescribir la capa de datos.
 * Que siga en el typecheck es lo que impide que se podrifique en silencio.
 */

import { createRepositories } from "@/lib/backend/adapters/postgrest/kernel";
import { createSupabaseAuthProvider } from "@/lib/backend/adapters/supabase/auth";
import { getSupabaseClient } from "@/lib/backend/adapters/supabase/client";
import { createSupabaseRowStore } from "@/lib/backend/adapters/supabase/store";
import type { BackendProvider } from "@/lib/backend/ports";

// Solo por su efecto en el typecheck: prueba que los tipos generados siguen
// describiendo el esquema que el núcleo compartido espera.
import "@/lib/backend/adapters/supabase/schema-check";

export function createSupabaseBackend(): BackendProvider {
  const client = getSupabaseClient();
  return {
    name: "supabase",
    auth: createSupabaseAuthProvider(client),
    ...createRepositories(createSupabaseRowStore(client)),
  };
}
