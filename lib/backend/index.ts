/**
 * El interruptor, mitad de navegador.
 *
 * Una variable decide qué Proveedor de Backend está activo. Cambiarla y
 * redesplegar es todo lo que hace falta para pasar de un proveedor a otro: nada
 * fuera de `lib/backend/` sabe cuál es. La variable la lee
 * `lib/backend/switch.ts`, compartido con la mitad de servidor.
 *
 * ── Lo que el ADR 0006 cambió aquí ────────────────────────────────────────
 *
 * El proveedor que ve el navegador ya no sale entero de un adaptador: son dos
 * piezas cosidas. La mitad de AUTH sigue siendo del adaptador activo, porque el
 * cliente de Better Auth vive ahí y habla con `/api/auth`. Los REPOSITORIOS son
 * siempre el adaptador HTTP, que llama a `/api/*` — y desde este lado del cable
 * ya no se puede saber qué motor hay detrás, que es exactamente lo que se
 * buscaba: ninguna petición del navegador sale hacia el proveedor.
 *
 * El interruptor sigue siendo uno. Lo que pasa es que ahora mueve tres mitades
 * en vez de dos, y dos de ellas están en el servidor (`lib/backend/server.ts`).
 *
 * El mapa es estático a propósito. Un `import()` dinámico dejaría al proveedor
 * dormido fuera del typecheck y del bundle, y entonces «volver es cambiar una
 * variable» sería falso: sería cambiar una variable y descubrir qué se ha roto
 * mientras nadie miraba.
 */

import { createHttpRepositories } from "@/lib/backend/adapters/http";
import { createNeonAuth } from "@/lib/backend/adapters/neon";
import { createSupabaseAuth } from "@/lib/backend/adapters/supabase";
import { readBackendName, type BackendName } from "@/lib/backend/switch";
import type { AuthProvider, BackendProvider } from "@/lib/backend/ports";

const ADAPTERS: Record<BackendName, () => AuthProvider> = {
  neon: createNeonAuth,
  supabase: createSupabaseAuth,
};

let active: BackendProvider | null = null;

/**
 * El Proveedor de Backend activo.
 *
 * Perezoso y memoizado, igual que los clientes que envuelve: nada se construye
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
 *
 * Se llama desde el navegador, y desde dentro de un handler —nunca durante el
 * render de un Server Component: el cliente de auth resuelve su URL contra
 * `window.location.origin`, que en el servidor no existe.
 */
export function getBackend(): BackendProvider {
  if (active) return active;
  const name = readBackendName();
  active = {
    name,
    auth: ADAPTERS[name](),
    ...createHttpRepositories(),
  };
  return active;
}

/** Solo para tests: obliga a releer el interruptor. */
export function resetBackend(): void {
  active = null;
}

export * from "@/lib/backend/ports";
export {
  BACKEND_ENV_KEY,
  BACKEND_NAMES,
  readBackendName,
} from "@/lib/backend/switch";
export type { BackendName } from "@/lib/backend/switch";
