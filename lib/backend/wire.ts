/**
 * El códec del cable: cómo viajan las entidades y los errores del puerto.
 *
 * Vive en `lib/backend/` y no bajo `ports/` ni bajo `adapters/` por lo mismo que
 * `switch.ts` y `cookies.ts`: lo importan las TRES partes que tienen que estar
 * de acuerdo —el adaptador de navegador, el despachador de servidor y
 * `proxy.ts`— y ninguna de ellas puede importar de las otras. Un códec en dos
 * copias es un contrato que se rompe en silencio.
 *
 * Lo que este archivo NO es: una capa de validación. No comprueba que un título
 * quepa ni que un id sea un uuid. Eso lo aplican los `check` de las migraciones
 * y las reglas de `lib/services/`, que valen para todos los adaptadores. Aquí
 * solo se serializa y se deserializa.
 */

import {
  BackendError,
  ConflictError,
  MissingEnvError,
  NetworkError,
  NotFoundError,
  UnauthenticatedError,
} from "@/lib/backend/ports";

/**
 * La caja en la que viaja una fecha.
 *
 * Las entidades del puerto llevan `Date` y no cadenas ISO —lo dice la cabecera
 * de `ports/entities.ts`— y JSON no tiene fechas, así que hay que marcarlas.
 *
 * Se ENCAJONAN en vez de revivir «todo lo que parezca una fecha» por un motivo
 * concreto y no por gusto: `Analysis.content` es JSON que escribió un modelo, y
 * un reviver por patrón convertiría en `Date` cualquier cadena con pinta de
 * fecha que un Ticket mencionara de pasada. La caja no colisiona con nada que
 * el schema de `lib/ai/schema.ts` pueda producir.
 */
const DATE_BOX = "$date";

type DateBox = { readonly [DATE_BOX]: string };

function isDateBox(value: unknown): value is DateBox {
  return (
    typeof value === "object" &&
    value !== null &&
    DATE_BOX in value &&
    typeof (value as DateBox)[DATE_BOX] === "string" &&
    Object.keys(value).length === 1
  );
}

/**
 * Serializa encajonando las fechas.
 *
 * El `this[key]` no es un adorno: `JSON.stringify` llama a `Date.prototype.toJSON`
 * ANTES de pasarle el valor al replacer, así que un replacer que mire `raw` recibe
 * una cadena ya cocinada y no puede distinguir una fecha de un texto. `this` es el
 * objeto que la contiene, y ahí el `Date` sigue siendo un `Date`.
 */
export function encodeJson(value: unknown): string {
  return JSON.stringify(value, function (this: unknown, key, raw: unknown) {
    const original = (this as Record<string, unknown>)[key];
    if (original instanceof Date) {
      // Una fecha inválida no tiene ISO que escribir: `toISOString` lanza. Se
      // manda `null`, que es lo que el puerto usa para «no hay fecha», en vez
      // de reventar la respuesta entera por un dato roto.
      return Number.isNaN(original.getTime())
        ? null
        : ({ [DATE_BOX]: original.toISOString() } satisfies DateBox);
    }
    return raw;
  });
}

/** Deserializa deshaciendo las cajas. Inversa exacta de `encodeJson`. */
export function decodeJson(text: string): unknown {
  return JSON.parse(text, (_key, raw: unknown) =>
    isDateBox(raw) ? new Date(raw[DATE_BOX]) : raw,
  );
}

/**
 * Un error del puerto, aplanado para el cable.
 *
 * Lleva los CAMPOS y no solo el mensaje, y eso no es opcional: la interfaz
 * distingue un `ConflictError` por su `rule` y no por su texto —ver
 * `LAST_VERSION_MESSAGE`, que la pantalla lee para deshabilitar el botón ANTES
 * de intentarlo— y un `NotFoundError` nombra el recurso. Mandar solo el mensaje
 * dejaría al otro lado con cinco errores indistinguibles.
 */
export type WireError =
  | { kind: "not_found"; message: string; resource: string; id: string | null }
  | { kind: "conflict"; message: string; rule: string }
  | { kind: "unauthenticated"; message: string }
  | { kind: "missing_env"; message: string; key: string }
  | { kind: "network"; message: string }
  | { kind: "unknown"; message: string };

/** El sobre que devuelve toda ruta de datos. Uno de los dos campos, nunca ambos. */
export type WireEnvelope =
  | { readonly value: unknown }
  | { readonly error: WireError };

/**
 * El texto que se manda cuando el error no es del puerto.
 *
 * Genérico A PROPÓSITO: un error inesperado en el servidor puede llevar dentro
 * el nombre de una columna, un fragmento de SQL o el contenido de un Nodo, y
 * nada de eso tiene por qué cruzar hasta el navegador. El original se queda en
 * el log del servidor, que es donde se mira cuando algo se rompe.
 */
export const OPAQUE_FAILURE = "Algo ha fallado en el servidor.";

export function encodeBackendError(error: unknown): WireError {
  if (error instanceof NotFoundError) {
    return {
      kind: "not_found",
      message: error.message,
      resource: error.resource,
      id: error.id,
    };
  }
  if (error instanceof ConflictError) {
    return { kind: "conflict", message: error.message, rule: error.rule };
  }
  if (error instanceof UnauthenticatedError) {
    return { kind: "unauthenticated", message: error.message };
  }
  if (error instanceof MissingEnvError) {
    return { kind: "missing_env", message: error.message, key: error.key };
  }
  if (error instanceof NetworkError) {
    return { kind: "network", message: error.message };
  }
  return { kind: "unknown", message: OPAQUE_FAILURE };
}

/**
 * Qué status HTTP le corresponde.
 *
 * El status es para los humanos y para los logs: quien decide de verdad es el
 * `kind` del cuerpo. Se elige igualmente con cuidado porque una ruta que
 * contesta 200 a un fallo es una ruta que nadie puede monitorizar.
 *
 * `not_found` es 404 y NUNCA 403, y esa es una consecuencia del ADR 0001 que
 * hay que sostener a mano en esta capa: bajo RLS «no es tuyo» y «no existe» son
 * cero filas, y contestar 403 le confirmaría a un atacante que el recurso
 * existe. El oráculo que el ADR cerró en el motor se reabriría aquí.
 */
export function statusForWireError(error: WireError): number {
  switch (error.kind) {
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "unauthenticated":
      return 401;
    case "network":
      return 502;
    case "missing_env":
    case "unknown":
      return 500;
  }
}

/**
 * Reconstruye la clase correcta al otro lado.
 *
 * El mensaje se sobrescribe DESPUÉS de construir porque los constructores del
 * puerto arman el suyo: `new NotFoundError("Proyecto", id)` escribe «No se
 * encontró...», y sin esta línea la frase del servidor —`LAST_VERSION_MESSAGE`,
 * el `hint` de una variable que falta— se perdería por el camino.
 *
 * Lo que no se reconoce sale como `NetworkError`, y es deliberado: es la única
 * categoría que significa «la petición no aterrizó», que es exactamente lo que
 * la interfaz necesita saber para reintentar y encender el bloqueo de edición.
 * Un sobre ilegible es una respuesta que no llegó.
 */
export function decodeBackendError(raw: unknown): BackendError {
  if (typeof raw !== "object" || raw === null || !("kind" in raw)) {
    return new NetworkError(undefined, { cause: raw });
  }

  const wire = raw as Partial<WireError> & { kind: string };
  const message = typeof wire.message === "string" ? wire.message : undefined;

  switch (wire.kind) {
    case "not_found": {
      const resource = typeof wire.resource === "string" ? wire.resource : "recurso";
      const id = typeof wire.id === "string" ? wire.id : null;
      const error = new NotFoundError(resource, id);
      if (message) error.message = message;
      return error;
    }
    case "conflict": {
      const rule = typeof wire.rule === "string" ? wire.rule : "desconocida";
      return new ConflictError(rule, message ?? OPAQUE_FAILURE);
    }
    case "unauthenticated":
      return new UnauthenticatedError(message);
    case "missing_env": {
      const key = typeof wire.key === "string" ? wire.key : "desconocida";
      const error = new MissingEnvError(key);
      if (message) error.message = message;
      return error;
    }
    default:
      // `network` y `unknown` caen aquí, y también un `kind` que este cliente
      // todavía no conoce porque el servidor va por delante en un despliegue.
      return new NetworkError(message, { cause: raw });
  }
}
