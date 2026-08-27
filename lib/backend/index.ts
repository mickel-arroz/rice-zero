/**
 * El interruptor.
 *
 * Una variable decide qué Proveedor de Backend está activo. Cambiarla y
 * redesplegar es todo lo que hace falta para pasar de un proveedor a otro: nada
 * fuera de `lib/backend/` sabe cuál es.
 *
 * El mapa es estático a propósito. Un `import()` dinámico dejaría al proveedor
 * dormido fuera del typecheck y del bundle, y entonces «volver es cambiar una
 * variable» sería falso: sería cambiar una variable y descubrir qué se ha roto
 * mientras nadie miraba.
 *
 * Los adaptadores son de navegador: el ADR decide que el cliente habla DIRECTO
 * con PostgREST y que la autorización se queda en RLS. Renderizar en servidor
 * con la sesión de la petición es otra pieza —el handler de auth, el refresco de
 * cookies, `proxy.ts`— y la trae el ticket de autenticación (#7). Hasta
 * entonces, `getBackend()` se llama desde el cliente.
 */

import { createNeonBackend } from "@/lib/backend/adapters/neon";
import { createSupabaseBackend } from "@/lib/backend/adapters/supabase";
import { MissingEnvError, type BackendProvider } from "@/lib/backend/ports";

export const BACKEND_ENV_KEY = "NEXT_PUBLIC_BACKEND";

const ADAPTERS = {
  neon: createNeonBackend,
  supabase: createSupabaseBackend,
} as const;

export type BackendName = keyof typeof ADAPTERS;

export const BACKEND_NAMES = Object.keys(ADAPTERS) as BackendName[];

function isBackendName(value: string): value is BackendName {
  return value in ADAPTERS;
}

/**
 * Qué proveedor pide el entorno.
 *
 * @throws MissingEnvError si la variable falta o nombra un proveedor que no
 * existe. Un nombre inventado no cae a un default: elegir por él sería mandar
 * la app a la base de datos equivocada sin decir nada.
 */
export function readBackendName(): BackendName {
  // Literal a propósito: Next incrusta los `NEXT_PUBLIC_*` en tiempo de build
  // sustituyendo el texto, así que un acceso indirecto no se sustituye.
  const raw = process.env.NEXT_PUBLIC_BACKEND?.trim();
  if (!raw) {
    throw new MissingEnvError(
      BACKEND_ENV_KEY,
      `Ponla a uno de: ${BACKEND_NAMES.join(", ")}.`,
    );
  }
  if (!isBackendName(raw)) {
    throw new MissingEnvError(
      BACKEND_ENV_KEY,
      `«${raw}» no es un Proveedor de Backend. Los que hay: ${BACKEND_NAMES.join(", ")}.`,
    );
  }
  return raw;
}

let active: BackendProvider | null = null;

/**
 * El Proveedor de Backend activo.
 *
 * Perezoso y memoizado, igual que los clientes que envuelve: nada se construye
 * al importar el módulo, para que la app siga renderizando aunque falte
 * configuración hasta que de verdad haya que hablar con el backend.
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
