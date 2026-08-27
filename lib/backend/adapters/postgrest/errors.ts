/**
 * Traducción de errores de PostgREST/Postgres a la taxonomía del puerto.
 *
 * Compartida por los dos adaptadores porque los códigos son del motor, no del
 * proveedor: `23505` es un unique violation en cualquier Postgres y `PGRST301`
 * es un JWT caducado en cualquier PostgREST.
 */

import {
  BackendError,
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
 */
const NOT_FOUND_CODES = new Set(["P0002", "PGRST116"]);

/**
 * `42501` (insufficient_privilege) llega por dos caminos que Postgres no
 * distingue por código, solo por mensaje:
 *
 *   · el `with check` de una política — escribir fuera de tus datos;
 *   · un GRANT que falta — el rol no tiene el privilegio de tabla.
 *
 * El primero es la denegación por RLS que el ADR manda reportar como
 * `NotFoundError`: bajo RLS «no es tuyo» y «no existe» son cero filas, y
 * distinguirlos le confirmaría a un atacante que el recurso existe.
 *
 * El segundo NO puede reportarse igual. Un despliegue al que se le olvidó un
 * GRANT contestaría «no existe» a todo, y el síntoma sería una app vacía en vez
 * de un error. Se reporta como falta de sesión, que es su causa abrumadoramente
 * más probable —con los privilegios bien puestos, el único rol al que le faltan
 * es el anónimo— y que además es ruidoso: manda a login en lugar de callarse.
 */
const RLS_DENIAL = /row[- ]level security/i;

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
  if (code === "42501") {
    return RLS_DENIAL.test(failure.message)
      ? new NotFoundError(resource, id, { cause: failure })
      : new UnauthenticatedError(failure.message, { cause: failure });
  }
  if (UNAUTHENTICATED_CODES.has(code)) {
    return new UnauthenticatedError(undefined, { cause: failure });
  }

  const rule = CONFLICT_CODES.get(code);
  if (rule) {
    return new ConflictError(rule, failure.message, { cause: failure });
  }

  // Sin código es un fallo de transporte: 5xx sin cuerpo, un gateway que
  // contesta con texto. Es el único caso que tiene sentido reintentar.
  if (!code) {
    return new NetworkError(failure.message, { cause: failure });
  }

  // Con código, pero uno que no conocemos. Reintentar no lo va a arreglar, así
  // que NO puede ser `NetworkError`: un `22P02` (uuid mal formado) reintentado
  // en bucle es peor que un error a la cara. `ConflictError` es lo que la
  // taxonomía tiene para «el motor lo rechazó y volver a pedirlo no cambia
  // nada»; el código exacto viaja en `cause`.
  return new ConflictError(`motor:${code}`, failure.message, { cause: failure });
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

/**
 * Deja pasar lo que ya es un error del puerto y envuelve lo demás.
 *
 * Los `catch` de los adaptadores están para el `fetch` que rechaza, no para el
 * error que ellos mismos acaban de lanzar; sin este filtro se lo comerían y lo
 * reetiquetarían como fallo de red.
 */
export function keepBackendError(error: unknown): Error {
  return error instanceof BackendError ? error : translateThrown(error);
}
