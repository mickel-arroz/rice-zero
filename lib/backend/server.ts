/**
 * El interruptor, en su versión de servidor.
 *
 * `lib/backend/index.ts` es el que usa el navegador; este es el que usan
 * `proxy.ts`, el Route Handler de auth y los Server Components. Lee la MISMA
 * variable, así que sigue habiendo un solo interruptor: cambiar
 * `NEXT_PUBLIC_BACKEND` mueve las dos mitades a la vez.
 *
 * El mapa es estático por lo mismo que el otro: un `import()` dinámico dejaría al
 * proveedor dormido fuera del typecheck, y entonces «volver es cambiar una
 * variable» sería mentira.
 */

import "server-only";

import { createNeonServerBackend } from "@/lib/backend/adapters/neon/server";
import { createSupabaseServerBackend } from "@/lib/backend/adapters/supabase/server";
import { readBackendName, type BackendName } from "@/lib/backend/switch";
import type { ServerBackendProvider } from "@/lib/backend/ports";

const SERVER_ADAPTERS: Record<BackendName, () => ServerBackendProvider> = {
  neon: createNeonServerBackend,
  supabase: createSupabaseServerBackend,
};

let active: ServerBackendProvider | null = null;

/**
 * El Proveedor de Backend activo, visto desde el servidor.
 *
 * Perezoso y memoizado igual que el del navegador: nada se construye al importar
 * el módulo. Aquí importa más, porque este módulo lo importa `proxy.ts` y un
 * throw al importar tumbaría TODAS las peticiones, incluidas las públicas.
 */
export function getServerBackend(): ServerBackendProvider {
  if (active) return active;
  active = SERVER_ADAPTERS[readBackendName()]();
  return active;
}

/** Solo para tests: obliga a releer el interruptor. */
export function resetServerBackend(): void {
  active = null;
}
