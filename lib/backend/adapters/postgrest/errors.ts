/**
 * Traducción de errores de PostgREST/Postgres a la taxonomía del puerto.
 *
 * Compartida por los dos adaptadores porque los códigos son del motor, no del
 * proveedor: `23505` es un unique violation en cualquier Postgres y `PGRST301`
 * es un JWT caducado en cualquier PostgREST.
 */

import {
  ConflictError,
  NetworkError,
  NotFoundError,
  UnauthenticatedError,
} from "@/lib/backend/ports";

/** Lo que ambos SDKs devuelven en `error`, reducido a lo que se mira. */
export type PostgrestFailure = {
  message: string;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Códigos que significan «esta petición no tiene sesión válida». */
const UNAUTHENTICATED_CODES = new Set(["PGRST301", "PGRST302"]);

/** Reglas del esquema que el usuario puede chocar sin que nada esté roto. */
const CONFLICT_CODES = new Map([
  ["23505", "unique"],
  ["23503", "referencia"],
  ["23514", "check"],
  ["23502", "not-null"],
]);

/**
 * Códigos que el puerto reporta como «no existe, o no es tuyo».
 *
 * `P0002` (no_data_found) es lo que lanza `clone_project_version` cuando la
 * Versión de origen no existe o no es tuya.
 *
 * `42501` (insufficient_privilege) es una denegación por RLS: escribir fuera de
 * tus datos. Va aquí y no a un error de permisos propio porque es la decisión
 * del ADR — bajo RLS «no es tuyo» y «no existe» son el mismo resultado, y
 * distinguirlos le confirmaría a un atacante que el recurso existe. Sin sesión
 * ni se llega a la tabla: PostgREST responde antes con PGRST301.
 */
const NOT_FOUND_CODES = new Set(["P0002", "PGRST116", "42501"]);

/**
 * Convierte un fallo de PostgREST en un error del puerto.
 *
 * `resource` solo se usa si el código resulta ser de «no existe»; el resto de
 * categorías no nombran el recurso, a propósito.
 */
export function translatePostgrestFailure(
  failure: PostgrestFailure,
  resource: string,
  id: string | null = null,
): Error {
  const code = failure.code ?? "";

  if (NOT_FOUND_CODES.has(code)) {
    return new NotFoundError(resource, id, { cause: failure });
  }
  if (UNAUTHENTICATED_CODES.has(code)) {
    return new UnauthenticatedError(undefined, { cause: failure });
  }

  const rule = CONFLICT_CODES.get(code);
  if (rule) {
    return new ConflictError(rule, failure.message, { cause: failure });
  }

  // Sin código es un fallo de transporte: `fetch` rechazado, DNS, 5xx sin
  // cuerpo. Es el único caso que tiene sentido reintentar.
  return new NetworkError(failure.message, { cause: failure });
}

/**
 * Un error que no vino del motor: `fetch` que rechaza, `AbortError`, un
 * `AuthRequiredError` del SDK. Solo el adaptador sabe distinguirlos, así que
 * aquí solo se cubre el caso genérico.
 */
export function translateThrown(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new NetworkError("La petición se canceló.", { cause: error });
  }
  return new NetworkError(
    error instanceof Error ? error.message : "Fallo desconocido del backend.",
    { cause: error },
  );
}
