/**
 * Taxonomía de errores del Proveedor de IA.
 *
 * Siete categorías, porque son las siete decisiones distintas que la interfaz
 * puede tomar al recibir un fallo: esperar a que vuelva la cuota, reintentar
 * porque tardó, reintentar porque no hubo red, reintentar porque el modelo
 * contestó cualquier cosa, rendirse porque falta configuración, mandar a login,
 * o decirle a la persona que arregle lo que mandó. Todo lo demás es detalle del
 * adaptador y viaja en `cause`.
 *
 * Cinco las puede lanzar un adaptador. `sesion` la lanza solo el Server Action,
 * que es un punto de entrada público (los docs de Next: «trátalo como no
 * confiable»). `entrada` la lanzan los tres —servicio, action y adaptador—,
 * porque «esto no se puede analizar» se descubre en los tres sitios. Están en la misma lista y no en otra porque
 * quien las enumera es la misma pantalla, y dos enums para un solo `switch` es
 * cómo se escribe un caso que nadie cubre.
 *
 * Mismo criterio que `lib/backend/ports/errors.ts`, y por la misma razón: un
 * `catch` que tiene que leer el mensaje para decidir qué hacer no es una
 * taxonomía, es adivinar. Lo que NO se copia de allí es la jerarquía: un
 * `NetworkError` de la IA y uno del backend significan cosas distintas —el
 * segundo enciende el bloqueo de edición offline y el primero no— así que
 * tenerlos en el mismo árbol solo invitaría a tratarlos igual.
 *
 * `retryable` va en la clase y no en un `switch` de la pantalla porque es lo
 * único que la pantalla necesita preguntar, y preguntarlo con una cadena de
 * `instanceof` en cada sitio es la forma de que el día que nazca una categoría
 * nueva alguien se olvide de un sitio.
 *
 * Módulo puro, sin imports: lo consume tanto el adaptador (que los lanza) como
 * la interfaz (que los cataloga).
 */

/**
 * Las categorías, como valores.
 *
 * Existen ADEMÁS de las clases porque hay una frontera que las clases no
 * cruzan: el Server Action de generación. Lo que vuelve de un Server Action se
 * serializa, así que al otro lado no hay un `QuotaExceededError` — hay un
 * objeto plano. Sin un discriminante, la interfaz tendría que decidir mirando
 * el mensaje, que es exactamente lo que la taxonomía existe para evitar.
 *
 * En español y no en inglés como los nombres de clase, porque estos valores no
 * son identificadores de código: son lo que la pantalla del panel va a
 * enumerar en su `switch`, y ahí manda el idioma del dominio.
 */
export const ANALYSIS_ERROR_KINDS = [
  "cuota",
  "timeout",
  "red",
  "malformada",
  "configuracion",
  "sesion",
  "entrada",
] as const;

export type AnalysisErrorKind = (typeof ANALYSIS_ERROR_KINDS)[number];

/** Raíz común: permite `catch (e) { if (e instanceof AnalysisError) … }`. */
export abstract class AnalysisError extends Error {
  /** La categoría, como valor. Es lo único que cruza el Server Action. */
  abstract readonly kind: AnalysisErrorKind;

  /**
   * ¿Tiene sentido volver a pulsar «Generar» ahora mismo?
   *
   * `false` no es «no se puede nunca»: la cuota vuelve al día siguiente y una
   * variable que falta se puede poner. Es «no ahora, y repetirlo no cambia
   * nada», que es lo que decide si la interfaz ofrece el botón.
   */
  abstract readonly retryable: boolean;

  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/**
 * Se agotó la cuota del proveedor: el 429.
 *
 * Es su propia categoría y no un fallo de red cualquiera porque es el único
 * cuyo remedio es esperar, y porque el free tier de Gemini lo va a dar de
 * verdad — el proyecto corre ahí a propósito.
 */
export class QuotaExceededError extends AnalysisError {
  readonly kind = "cuota" as const;
  readonly retryable = false;

  /** Cuánto pide el proveedor que se espere, si lo dijo. En segundos. */
  readonly retryAfterSeconds: number | null;

  constructor(
    retryAfterSeconds: number | null = null,
    options?: { cause?: unknown },
  ) {
    super(
      retryAfterSeconds === null
        ? "Se agotó la cuota de la IA. Vuelve a intentarlo más tarde."
        : `Se agotó la cuota de la IA. Vuelve a intentarlo en ${retryAfterSeconds} s.`,
      options,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * El modelo no contestó a tiempo.
 *
 * Aparte de la red porque el árbol entra entero en el prompt y un árbol grande
 * tarda de verdad: quien lo reciba puede querer decir «prueba con menos», y no
 * podría distinguir este caso de un cable suelto si los dos llegaran igual.
 */
export class AnalysisTimeoutError extends AnalysisError {
  readonly kind = "timeout" as const;
  readonly retryable = true;

  constructor(options?: { cause?: unknown }) {
    super("La IA tardó demasiado en responder.", options);
  }
}

/** No se pudo hablar con el proveedor: sin red, DNS, 5xx. */
export class AnalysisNetworkError extends AnalysisError {
  readonly kind = "red" as const;
  readonly retryable = true;

  constructor(
    message = "No se pudo contactar con la IA.",
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/**
 * La respuesta no es un Análisis válido.
 *
 * Un solo error para dos cosas que parecen distintas —JSON corrupto y un
 * objeto bien formado que incumple el contrato (un Ticket sin Checks, un ciclo
 * de bloqueos)— y es deliberado: el ADR 0003 decide que las reglas del schema
 * son afirmaciones y no consejos, así que fallar un `refine` tiene que salir
 * por el MISMO camino que un JSON roto. Si tuvieran errores distintos, alguien
 * acabaría persistiendo el segundo.
 */
export class MalformedAnalysisError extends AnalysisError {
  readonly kind = "malformada" as const;

  /**
   * Reintentar SÍ, aunque suene raro: un modelo es no determinista y la
   * siguiente pasada suele salir bien. Es exactamente por lo que la primera no
   * se persiste en vez de guardarse «a medias».
   */
  readonly retryable = true;

  /**
   * Qué falló, en frases cortas. Para diagnóstico y para el issue: son los
   * `path` + `message` de Zod, no un volcado de la respuesta.
   *
   * Nunca lleva el texto que devolvió el modelo. Ese texto es el árbol del
   * usuario masticado y acaba en logs.
   */
  readonly issues: readonly string[];

  constructor(issues: readonly string[] = [], options?: { cause?: unknown }) {
    super("La IA devolvió una respuesta que no es un Análisis válido.", options);
    this.issues = issues;
  }
}

/**
 * Falta configuración: la API key, o el nombre del proveedor.
 *
 * Se distingue de un fallo de red para que la interfaz lo trate como lo que
 * es —irrecuperable en runtime, y culpa nuestra y no del usuario— en vez de
 * ofrecer un «Reintentar» que no puede funcionar.
 */
export class AnalysisConfigError extends AnalysisError {
  readonly kind = "configuracion" as const;
  readonly retryable = false;

  /** La variable de entorno que falta, si el fallo es de una. */
  readonly key: string | null;

  constructor(
    message: string,
    key: string | null = null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.key = key;
  }
}

/**
 * Un `AnalysisError` que sí cruza el Server Action.
 *
 * Hace falta porque lo que vuelve de un Server Action se SERIALIZA: al otro
 * lado no llega un `QuotaExceededError`, llega un objeto plano — y si el action
 * hubiera hecho `throw`, en producción no llega ni eso, porque Next sustituye
 * los errores del servidor por un mensaje genérico y un digest. Así que el
 * action los DEVUELVE, en esta forma.
 *
 * Es un tipo plano y no una clase por lo mismo: una clase no sobrevive a
 * `JSON`, y fingir que sí es cómo se acaba leyendo `undefined` en producción.
 */
export type AnalysisFailure = {
  kind: AnalysisErrorKind;
  /** Ya en español y ya listo para enseñar: lo escribió la clase que falló. */
  message: string;
  retryable: boolean;
  /** Solo lo llena `cuota`, y solo si el proveedor dijo cuánto. */
  retryAfterSeconds: number | null;
  /** Solo lo llena `malformada`: qué regla del schema se incumplió. */
  issues: readonly string[];
};

/**
 * De un error a su forma serializable.
 *
 * Acepta `unknown` porque lo llama un `catch`, que es lo único que un `catch`
 * promete. Lo que no sea un `AnalysisError` sale como `red`: llegar aquí con
 * otra cosa significa que algo se saltó `normalizeGeminiError`, y de las siete
 * categorías es la única cuya consecuencia —ofrecer reintentar— no hace daño si
 * la clasificación estaba equivocada. El mensaje original NO se copia: puede
 * ser el volcado de una excepción del SDK, y eso no se le enseña a nadie.
 */
export function describeAnalysisFailure(error: unknown): AnalysisFailure {
  if (!(error instanceof AnalysisError)) {
    const fallback = new AnalysisNetworkError();
    return {
      kind: fallback.kind,
      message: fallback.message,
      retryable: fallback.retryable,
      retryAfterSeconds: null,
      issues: [],
    };
  }

  // El que YA cruzó la frontera se copia entero y se sale.
  //
  // Hace falta porque el camino real describe el fallo DOS veces: el Server
  // Action serializa el original, el servicio lo relanza como
  // `RemoteAnalysisError` y quien lo atrapa lo vuelve a describir para
  // guardárselo. Sin esta rama, la segunda pasada devolvía `null` y `[]` sobre
  // un fallo que sí traía los datos — la cuenta atrás del 429 se perdía, y con
  // ella el botón de reintento del panel, sin que fallara nada. Lo cazó
  // `errors.test.ts` describiendo dos veces seguidas.
  //
  // Va primero y aparte en vez de repartirse por las ramas de abajo porque
  // este error ya ES la forma serializada: no hay nada que deducir de su clase.
  if (error instanceof RemoteAnalysisError) {
    return {
      kind: error.kind,
      message: error.message,
      retryable: error.retryable,
      retryAfterSeconds: error.retryAfterSeconds,
      issues: error.issues,
    };
  }

  return {
    kind: error.kind,
    message: error.message,
    retryable: error.retryable,
    retryAfterSeconds:
      error instanceof QuotaExceededError ? error.retryAfterSeconds : null,
    issues: error instanceof MalformedAnalysisError ? error.issues : [],
  };
}

/**
 * El fallo que volvió del servidor, otra vez como excepción.
 *
 * Es UNA clase para todas las categorías y no una reconstrucción de la que
 * falló, y es a propósito. Reconstruir `QuotaExceededError` a partir de un
 * objeto plano sería una ficción: la clase original llevaba una `cause` con el
 * error del SDK y una `key` con la variable que falta, y ninguna de las dos
 * cruza la frontera. Una clase que finge ser la de allí, con la mitad de los
 * campos vacíos, es peor que una que dice de dónde viene.
 *
 * Quien decide qué hacer mira `kind`, que es lo mismo a los dos lados. El
 * `instanceof` sobre las clases concretas sigue sirviendo donde los objetos son
 * reales: en el servidor.
 */
export class RemoteAnalysisError extends AnalysisError {
  readonly kind: AnalysisErrorKind;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;
  readonly issues: readonly string[];

  constructor(failure: AnalysisFailure) {
    super(failure.message);
    this.kind = failure.kind;
    this.retryable = failure.retryable;
    this.retryAfterSeconds = failure.retryAfterSeconds;
    this.issues = failure.issues;
  }
}

/**
 * No hay sesión, así que no se genera nada.
 *
 * Vive en la taxonomía de la IA aunque hable de auth porque quien la lanza es
 * el Server Action de generación y quien la recibe es el panel: es una de las
 * cosas que pueden salir mal al pedir un Análisis. El `UnauthenticatedError`
 * del backend sigue siendo el de las lecturas y escrituras del navegador; éste
 * es el del punto de entrada público que gasta cuota.
 */
export class SessionRequiredError extends AnalysisError {
  readonly kind = "sesion" as const;

  /**
   * `false`: reintentar sin haber entrado da el mismo resultado. Lo que la
   * interfaz tiene que hacer con esto es mandar a login, no ofrecer un botón.
   */
  readonly retryable = false;

  constructor() {
    super("Hay que entrar para generar un Análisis.");
  }
}

/**
 * Lo que se mandó no se puede analizar.
 *
 * Dos cosas caben aquí, y las dos son de la persona y no del modelo: una
 * Versión en la que nadie ha escrito nada, y un árbol tan grande que no cabe en
 * una petición. En ninguno de los dos casos se llega a llamar a la IA — que es
 * el punto: son los fallos que se atrapan ANTES de gastar cuota.
 *
 * Está en la taxonomía de la IA, y no como un `ConflictError` del backend,
 * porque quien lo recibe es el panel de Análisis: darle DOS taxonomías para
 * decidir qué enseñar al pedir un Análisis es lo que garantiza que un día se
 * olvide una. `ConflictError` sigue siendo el de las reglas del motor.
 *
 * El mensaje lo pone quien lanza: el hueco es distinto en cada caso, y un
 * mensaje genérico —«la entrada no vale»— no le dice a nadie qué arreglar.
 */
export class InvalidAnalysisInputError extends AnalysisError {
  readonly kind = "entrada" as const;

  /** Volver a mandar lo mismo da lo mismo. Lo que hay que cambiar es la entrada. */
  readonly retryable = false;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
