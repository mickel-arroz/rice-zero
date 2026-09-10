/**
 * El adaptador de Supabase en el NAVEGADOR. Dormido pero compilando.
 *
 * El interruptor (`NEXT_PUBLIC_BACKEND`) apunta a Neon; esto existe para que
 * volver sea cambiar la variable y redesplegar, no reescribir la capa de datos.
 * Que siga en el typecheck es lo que impide que se pudra en silencio.
 *
 * Igual que el de Neon, ya solo aporta auth: sus repositorios los pone el
 * adaptador HTTP, y quien habla con PostgREST es `adapters/supabase/server.ts`.
 */

import { createSupabaseAuthProvider } from "@/lib/backend/adapters/supabase/auth";
import { getSupabaseClient } from "@/lib/backend/adapters/supabase/client";
import type { AuthProvider } from "@/lib/backend/ports";

// Solo por su efecto en el typecheck: prueba que los tipos generados siguen
// describiendo el esquema que el núcleo compartido espera.
import "@/lib/backend/adapters/supabase/schema-check";

export function createSupabaseAuth(): AuthProvider {
  return createSupabaseAuthProvider(getSupabaseClient());
}
