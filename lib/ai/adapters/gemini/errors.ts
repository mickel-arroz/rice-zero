/**
 * De un fallo del SDK a la taxonomía del Proveedor de IA.
 *
 * Es una función PURA y en su propio archivo, y las dos cosas son a propósito.
 * Pura, porque clasificar un fallo no necesita red y la única forma de probar
 * el mapeo sin gastar cuota real es dárselo hecho (criterio del ticket: «mapeo
 * de 429 / timeout / red / malformada verificado con proveedor falso»). Aparte,
 * porque es lo único del adaptador que tiene reglas propias: el resto es
 * ensamblar una llamada.
 *
 * La regla de fondo: NADA sale de aquí sin clasificar. Un `throw` que no encaje
 * en ninguna categoría es un fallo nuestro o del SDK, y llega a la interfaz
 * clasificado igualmente — un error suelto cruzando el puerto obligaría a cada
 * `catch` a mirar el mensaje.
 */

import {
  APICallError,
  JSONParseError,
  LoadAPIKeyError,
  NoObjectGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";

import {
  AnalysisConfigError,
  AnalysisError,
  type AnalysisErrorKind,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
} from "@/lib/ai/errors";

/** El código con el que Google dice «se agotó la cuota». */
const TOO_MANY_REQUESTS = 429;

/**
 * Los códigos que significan «lo que pediste no existe o no te dejan».
 *
 * Un 404 está aquí y no en la red porque el ticket ya lo anticipa: los ids de
 * modelo de Gemini son volátiles, así que el fallo más probable de este
 * adaptador es que `AI_CONFIG.geminiModel` nombre un modelo retirado. Llamarlo
 * «no se pudo contactar con la IA» mandaría a reintentar para siempre.
 *
 * El 400 NO está aquí, y estuvo: parecía que con la petición armada por código
 * un «bad request» solo podía ser el schema o el modelo. No es cierto — Gemini
 * contesta 400 también cuando el prompt es demasiado grande o lleva contenido
 * que rechaza, y eso es el ÁRBOL de una persona. Mandarlo por aquí le habría
 * enseñado «revisa el modelo configurado y la API key» a alguien cuyo único
 * problema es que escribió mucho. Ver `BAD_REQUEST`.
 */
const CONFIG_STATUSES = new Set([401, 403, 404]);

/**
 * El código ambiguo.
 *
 * Un 400 de Gemini puede ser nuestra petición mal armada o el árbol del
 * usuario: demasiado largo, o con algo que el modelo no acepta. No hay forma de
 * distinguirlos desde aquí sin leerle el cuerpo a Google y confiar en unos
 * `reason` que no son contrato nuestro.
 *
 * Así que sale como `entrada`, con un mensaje que cubre las dos lecturas sin
 * mentir en ninguna, y el 400 entero viaja en `cause` para quien mire el log.
 * De las categorías es la única honesta con la duda: dice «lo que se mandó no
 * se pudo analizar», que es exactamente lo único que se sabe.
 */
const BAD_REQUEST = 400;

/**
 * Los nombres con los que un corte por reloj llega hasta aquí.
 *
 * Por NOMBRE y no por instancia: `AbortSignal.timeout()` lanza un
 * `DOMException` en el navegador y un `Error` en Node, y el SDK puede
 * reenvolverlo. El nombre es lo único que los tres comparten.
 */
const ABORT_NAMES = new Set(["TimeoutError", "AbortError"]);

/** Cuánto pide esperar la cabecera estándar, si vino y es un número. */
function retryAfterHeader(headers: Record<string, string> | undefined): number | null {
  const raw = headers?.["retry-after"];
  if (raw === undefined) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Cuánto pide esperar el cuerpo de error de Google.
 *
 * Por expresión regular sobre el cuerpo crudo y no navegando el JSON, y es una
 * decisión y no pereza: `retryDelay` vive dentro de `error.details[]`, un array
 * heterogéneo cuya forma y profundidad son de Google y no de ningún contrato
 * nuestro. Un camino a mano se rompería el día que metan un nivel más; buscar
 * el campo donde esté solo se rompe si le cambian el nombre, y entonces
 * volvemos a no saber el plazo, que es de donde partimos.
 */
function retryDelayInBody(body: string | undefined): number | null {
  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body ?? "");
  if (!match) return null;
  const seconds = Number.parseFloat(match[1]);
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

/**
 * Las quejas de Zod, en frases cortas, si esto es un error de validación.
 *
 * Duck typing y no `instanceof z.ZodError`: el error puede venir envuelto por
 * el SDK, que valida con su propia copia de Zod, y una comprobación por
 * identidad de clase fallaría en silencio justo ahí — dejando pasar como «red»
 * lo que es una respuesta malformada.
 */
function zodIssuesOf(error: unknown): string[] | null {
  const issues = (error as { issues?: unknown })?.issues;
  if (!Array.isArray(issues)) return null;

  return issues.map((issue) => {
    const { path, message } = issue as { path?: unknown; message?: unknown };
    const where = Array.isArray(path) && path.length > 0 ? path.join(".") : "(raíz)";
    return `${where}: ${String(message ?? "inválido")}`;
  });
}

/**
 * Baja por la cadena de `cause` buscando las quejas de Zod.
 *
 * Hace falta porque el camino real tiene tres capas: el SDK lanza
 * `NoObjectGeneratedError`, cuya `cause` es un `TypeValidationError`, cuya
 * `cause` es el error de Zod. Sin bajar, un Ticket sin Checks llegaría a la
 * interfaz como «no es un Análisis válido» y sin decir por qué, que es justo
 * lo que hace falta para poder arreglar el prompt.
 *
 * Con tope de profundidad: una `cause` que se apunte a sí misma es raro pero
 * no imposible, y un bucle infinito dentro de un `catch` no se diagnostica.
 */
function deepZodIssues(error: unknown, depth = 0): string[] {
  if (depth > 5 || error === null || typeof error !== "object") return [];
  return zodIssuesOf(error) ?? deepZodIssues((error as { cause?: unknown }).cause, depth + 1);
}

/** ¿Es el `TypeError` que lanza `fetch` cuando la petición no llegó a salir? */
function isFetchFailure(error: unknown): boolean {
  return error instanceof TypeError && /fetch failed|network/i.test(error.message);
}

export function normalizeGeminiError(error: unknown): AnalysisError {
  // Ya clasificado. Pasa cuando `analyze` valida la respuesta él mismo y su
  // `catch` envuelve también a esa validación: sin esto, un
  // `MalformedAnalysisError` propio saldría reetiquetado como red.
  if (error instanceof AnalysisError) return error;

  // El SDK reintenta solo y envuelve el último fallo. Se clasifica por lo que
  // envuelve: sin desenvolver, un 429 tras tres intentos llegaría como red y
  // la interfaz ofrecería un «Reintentar» que solo gasta más cuota.
  if (RetryError.isInstance(error)) {
    const last = error.lastError ?? error.errors.at(-1);
    return normalizeGeminiError(last);
  }

  if (error instanceof Error && ABORT_NAMES.has(error.name)) {
    return new AnalysisTimeoutError({ cause: error });
  }

  // Antes que `APICallError`: el error de validación puede llegar suelto —
  // cuando lo lanza nuestro propio `.parse`— o dentro de los del SDK.
  const issues = deepZodIssues(error);
  if (issues.length > 0) return new MalformedAnalysisError(issues, { cause: error });

  if (
    NoObjectGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error) ||
    JSONParseError.isInstance(error)
  ) {
    // Sin `issues`: el modelo no llegó a producir un objeto que validar, así
    // que no hay regla concreta que señalar. La `cause` conserva el detalle
    // para quien mire el log; el texto del modelo NO viaja al mensaje.
    return new MalformedAnalysisError([], { cause: error });
  }

  if (LoadAPIKeyError.isInstance(error)) {
    return new AnalysisConfigError(
      "Falta la API key de Gemini o no es válida.",
      GEMINI_API_KEY_ENV,
      { cause: error },
    );
  }

  if (APICallError.isInstance(error)) {
    if (error.statusCode === TOO_MANY_REQUESTS) {
      return new QuotaExceededError(
        retryAfterHeader(error.responseHeaders) ?? retryDelayInBody(error.responseBody),
        { cause: error },
      );
    }
    if (error.statusCode === BAD_REQUEST) {
      return new InvalidAnalysisInputError(
        "Gemini no aceptó la petición. Puede que el árbol sea demasiado grande o que lleve contenido que el modelo rechaza.",
        { cause: error },
      );
    }
    if (error.statusCode !== undefined && CONFIG_STATUSES.has(error.statusCode)) {
      return new AnalysisConfigError(
        `Gemini rechazó la petición con un ${error.statusCode}. Revisa el modelo configurado y la API key.`,
        null,
        { cause: error },
      );
    }
    // Todo lo demás con código —5xx— y también sin código: un `APICallError`
    // sin `statusCode` es una petición que no llegó a tener respuesta.
    return new AnalysisNetworkError(undefined, { cause: error });
  }

  if (isFetchFailure(error)) {
    return new AnalysisNetworkError(undefined, { cause: error });
  }

  // No hay categoría de reserva. Un fallo que no encaja en ninguna es nuestro o
  // del SDK, y sale como red porque es la única cuya consecuencia —ofrecer
  // reintentar— no hace daño si la clasificación estaba equivocada.
  return new AnalysisNetworkError(undefined, { cause: error });
}

/**
 * El nombre de la variable con la API key.
 *
 * Vive aquí y no solo en `index.ts` porque los dos la nombran: el adaptador
 * para leerla y este archivo para decir cuál falta. Dos literales iguales en
 * dos archivos es la clase de copia que sobrevive al primer renombrado y no al
 * segundo.
 */
export const GEMINI_API_KEY_ENV = "GEMINI_API_KEY";

/**
 * Las categorías que justifican probar el siguiente modelo de la lista.
 *
 * La pregunta que contesta esta lista no es «¿falló?» —eso ya lo sabemos— sino
 * «¿tiene esto pinta de ser culpa DE ESTE modelo?». Solo entonces cambiar de
 * modelo puede arreglar algo.
 *
 * Pasan al siguiente:
 *
 *   · `red` — el 503 de «high demand» es exactamente esto: este modelo está
 *     saturado, otro puede no estarlo. Es el caso que motivó la cadena.
 *   · `cuota` — los límites del free tier son POR MODELO, así que un 429 en uno
 *     no dice nada del siguiente. Y una petición rechazada no gasta cuota, así
 *     que probar sale gratis.
 *   · `configuracion` — aquí caen el 404 del modelo retirado (el caso que el
 *     ticket anticipaba, y que ya pasó con `gemini-2.5-flash`) y también el 401
 *     de una API key mala. Que la key mala pase al siguiente es un coste
 *     asumido: son cuatro rechazos de ~300 ms antes del error honesto. No
 *     pasarla habría roto el caso del modelo retirado, que es el que importa.
 *   · `timeout` — pasa, pero apenas significa nada: si un intento agotó el
 *     reloj, el presupuesto compartido ya casi no da para otro y la cadena se
 *     para sola en el siguiente giro. Está aquí para no tener que explicar por
 *     qué NO está.
 *
 * NO pasan al siguiente:
 *
 *   · `malformada` — el modelo sí contestó. Gastó tokens y, si razona, medio
 *     minuto; y que uno se salte la regla de los Checks no da ninguna razón
 *     para creer que el siguiente no lo hará. Encadenar aquí sería quemar el
 *     presupuesto entero produciendo basura. Lo que corresponde es reintentar
 *     —el modelo no es determinista— y para eso está `retryable`.
 *   · `entrada` — el problema es lo que se mandó: un árbol vacío o demasiado
 *     grande. Ningún modelo va a arreglar eso.
 *   · `sesion` — no la lanza ningún adaptador.
 */
const ADVANCES_MODEL = new Set<AnalysisErrorKind>([
  "red",
  "cuota",
  "configuracion",
  "timeout",
]);

/**
 * ¿Merece la pena intentarlo con el siguiente modelo?
 *
 * Toma un error YA clasificado, así que decide sobre la categoría y no sobre el
 * mensaje. Es lo que permite probar la política entera sin red y sin inventarse
 * errores del SDK.
 */
export function shouldTryAnotherModel(error: AnalysisError): boolean {
  return ADVANCES_MODEL.has(error.kind);
}
