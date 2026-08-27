/**
 * El interruptor, y nada más.
 *
 * Vive aparte de `index.ts` porque lo comparten las DOS mitades del proveedor:
 * la del navegador (`index.ts`) y la del servidor (`server.ts`). Si el servidor
 * tuviera que importar `index.ts` para leer la variable, se traería con él los
 * adaptadores de navegador —el SDK de Better Auth incluido— a `proxy.ts`, que
 * corre en cada petición y no necesita nada de eso.
 *
 * Un solo archivo lee la variable, así que sigue habiendo un solo interruptor.
 */

import { MissingEnvError } from "@/lib/backend/ports";

export const BACKEND_ENV_KEY = "NEXT_PUBLIC_BACKEND";

/** Los nombres, sin las fábricas: cada mitad tiene su propio mapa. */
export const BACKEND_NAMES = ["neon", "supabase"] as const;

export type BackendName = (typeof BACKEND_NAMES)[number];

function isBackendName(value: string): value is BackendName {
  return (BACKEND_NAMES as readonly string[]).includes(value);
}

/**
 * Qué proveedor pide el entorno.
 *
 * @throws MissingEnvError si la variable falta o nombra un proveedor que no
 * existe. Un nombre inventado no cae a un default: elegir por él sería mandar
 * la app a un Proveedor de Backend que nadie pidió, sin decir nada.
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
