/**
 * Taxonomía de errores del Proveedor de Backend.
 *
 * Cinco categorías, porque son las cinco decisiones distintas que la interfaz
 * puede tomar al recibir un fallo: reintentar, mandar a login, mostrar «no
 * existe», mostrar un conflicto de reglas, o rendirse porque falta
 * configuración. Todo lo demás es detalle del adaptador y viaja en `cause`.
 *
 * Ver `docs/adr/0001-proveedor-de-backend-intercambiable.md`.
 */

/** Raíz común: permite `catch (e) { if (e instanceof BackendError) … }`. */
export abstract class BackendError extends Error {
  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * El recurso no existe **o no es tuyo**. La ambigüedad es deliberada: bajo RLS
 * las dos cosas son el mismo resultado —cero filas—, y distinguirlas le
 * confirmaría a un atacante que el recurso existe.
 */
export class NotFoundError extends BackendError {
  readonly resource: string;
  readonly id: string | null;

  constructor(resource: string, id: string | null = null, options?: { cause?: unknown }) {
    super(
      id
        ? `No se encontró ${resource} ${id}, o no es tuyo.`
        : `No se encontró ${resource}, o no es tuyo.`,
      options,
    );
    this.resource = resource;
    this.id = id;
  }
}

/**
 * La operación choca con una regla del dominio o con una invariante del motor:
 * borrar la última Versión de un Proyecto, colgar un Nodo de otra Versión, un
 * número de Versión ya usado. Reintentar tal cual no arregla nada.
 */
export class ConflictError extends BackendError {
  /** La regla que se violó, en una frase corta y estable. */
  readonly rule: string;

  constructor(rule: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.rule = rule;
  }
}

/**
 * No se pudo hablar con el backend: sin red, timeout, 5xx. Es el único error
 * de la taxonomía que tiene sentido reintentar, y el que enciende el bloqueo
 * de edición offline (ver «Autoguardado» en `CONTEXT.md`).
 */
export class NetworkError extends BackendError {
  constructor(message = "No se pudo contactar con el backend.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** No hay sesión, o caducó. La interfaz manda a login. */
export class UnauthenticatedError extends BackendError {
  constructor(message = "No hay sesión activa.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/**
 * Falta una variable de entorno obligatoria. Se distingue de un error
 * cualquiera para que la interfaz lo trate como un fallo de configuración
 * (irrecuperable en runtime) y no como un fallo de red.
 */
export class MissingEnvError extends BackendError {
  readonly key: string;

  constructor(key: string, hint?: string) {
    super(`Falta la variable de entorno ${key}.${hint ? ` ${hint}` : ""}`);
    this.key = key;
  }
}
