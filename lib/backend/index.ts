/**
 * El interruptor, mitad de navegador.
 *
 * Una variable decide qué Proveedor de Backend está activo. Cambiarla y
 * redesplegar es todo lo que hace falta para pasar de un proveedor a otro: nada
 * fuera de `lib/backend/` sabe cuál es. La variable la lee
 * `lib/backend/switch.ts`, compartido con la mitad de servidor.
 *
 * El mapa es estático a propósito. Un `import()` dinámico dejaría al proveedor
 * dormido fuera del typecheck y del bundle, y entonces «volver es cambiar una
 * variable» sería falso: sería cambiar una variable y descubrir qué se ha roto
 * mientras nadie miraba.
 *
 * Esto es el proveedor tal y como lo ve el NAVEGADOR: el ADR 0001 decide que el
 * cliente habla DIRECTO con PostgREST y que la autorización se queda en RLS. Lo
 * que el servidor necesita —leer la sesión de una petición, decidir si pasa,
 * montar el handler de auth— es `lib/backend/server.ts`, y lo trajo el ticket de
 * autenticación (#7). Ver `docs/adr/0002-sesion-de-primera-parte.md`.
 */

import { createNeonBackend } from "@/lib/backend/adapters/neon";
import { createSupabaseBackend } from "@/lib/backend/adapters/supabase";
import { readBackendName, type BackendName } from "@/lib/backend/switch";
import type { BackendProvider } from "@/lib/backend/ports";

const ADAPTERS: Record<BackendName, () => BackendProvider> = {
  neon: createNeonBackend,
  supabase: createSupabaseBackend,
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
  active = ADAPTERS[readBackendName()]();
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
