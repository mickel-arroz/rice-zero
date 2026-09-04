import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  normalizeGeminiError,
  shouldTryAnotherModel,
} from "@/lib/ai/adapters/gemini/errors";
import {
  ANALYSIS_ERROR_KINDS,
  AnalysisConfigError,
  AnalysisError,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
  SessionRequiredError,
} from "@/lib/ai/errors";

/**
 * Un `NoObjectGeneratedError` como el que lanza el SDK cuando el modelo no
 * consiguió armar el objeto. Los metadatos son de relleno: lo único que este
 * archivo mira es en qué categoría cae.
 */
function noObject(text: string): NoObjectGeneratedError {
  return new NoObjectGeneratedError({
    message: "No object generated",
    text,
    response: { id: "1", modelId: "m", timestamp: new Date() },
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    },
    finishReason: "stop",
  });
}

/** Un `APICallError` como el que arma el SDK al recibir una respuesta HTTP. */
function apiError(
  statusCode: number,
  extra: { headers?: Record<string, string>; body?: string } = {},
): APICallError {
  return new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    requestBodyValues: {},
    statusCode,
    responseHeaders: extra.headers,
    responseBody: extra.body,
  });
}

describe("normalizeGeminiError", () => {
  describe("cuota", () => {
    it("un 429 es cuota agotada", () => {
      const error = normalizeGeminiError(apiError(429));
      expect(error).toBeInstanceOf(QuotaExceededError);
      expect(error.retryable).toBe(false);
    });

    it("lee los segundos de la cabecera retry-after", () => {
      const error = normalizeGeminiError(
        apiError(429, { headers: { "retry-after": "26" } }),
      );
      expect((error as QuotaExceededError).retryAfterSeconds).toBe(26);
      expect(error.message).toContain("26 s");
    });

    /**
     * Gemini casi nunca manda `retry-after`: manda `retryDelay` dentro del
     * cuerpo. Sin esto, el «vuelve en X» no saldría nunca en el proveedor real.
     */
    it("y si no, el retryDelay del cuerpo de Google", () => {
      const error = normalizeGeminiError(
        apiError(429, {
          body: JSON.stringify({
            error: { details: [{ retryDelay: "42s" }] },
          }),
        }),
      );
      expect((error as QuotaExceededError).retryAfterSeconds).toBe(42);
    });

    it("sin ninguna de las dos, no se inventa un plazo", () => {
      const error = normalizeGeminiError(apiError(429, { body: "{}" }));
      expect((error as QuotaExceededError).retryAfterSeconds).toBeNull();
    });
  });

  describe("configuración", () => {
    /** El caso que el propio ticket anticipa: los ids de modelo son volátiles. */
    it("un 404 es el modelo que ya no existe, no un fallo de red", () => {
      expect(normalizeGeminiError(apiError(404))).toBeInstanceOf(
        AnalysisConfigError,
      );
    });

    it("un 401 y un 403 son la API key", () => {
      expect(normalizeGeminiError(apiError(401))).toBeInstanceOf(
        AnalysisConfigError,
      );
      expect(normalizeGeminiError(apiError(403))).toBeInstanceOf(
        AnalysisConfigError,
      );
    });

    it("y no se ofrece reintentar lo que no puede cambiar", () => {
      expect(normalizeGeminiError(apiError(404)).retryable).toBe(false);
    });

    /** El detalle del SDK viaja en `cause`, como promete la taxonomía. */
    it("conserva el error del SDK para quien mire el log", () => {
      const original = apiError(404);
      expect(normalizeGeminiError(original).cause).toBe(original);
    });
  });

  /**
   * El 400 es el caso ambiguo, y el que estaba mal: Gemini lo devuelve tanto
   * por una petición mal armada por nosotros como por un árbol demasiado
   * grande. Clasificarlo como configuración le enseñaba «revisa el modelo y la
   * API key» a alguien cuyo único problema es que escribió mucho.
   */
  describe("entrada", () => {
    it("un 400 habla de lo que se mandó, no del modelo ni de la key", () => {
      const error = normalizeGeminiError(apiError(400));
      expect(error).toBeInstanceOf(InvalidAnalysisInputError);
      expect(error.kind).toBe("entrada");
    });

    it("y no se ofrece reintentar: lo mismo daría lo mismo", () => {
      expect(normalizeGeminiError(apiError(400)).retryable).toBe(false);
    });

    it("el mensaje no culpa a la configuración", () => {
      expect(normalizeGeminiError(apiError(400)).message).not.toMatch(/API key/i);
    });
  });

  describe("red", () => {
    it("un 5xx es el proveedor caído", () => {
      const error = normalizeGeminiError(apiError(503));
      expect(error).toBeInstanceOf(AnalysisNetworkError);
      expect(error.retryable).toBe(true);
    });

    it("un fetch que ni salió es red", () => {
      const error = normalizeGeminiError(
        new TypeError("fetch failed", { cause: new Error("ENOTFOUND") }),
      );
      expect(error).toBeInstanceOf(AnalysisNetworkError);
    });

    it("un APICallError sin código tampoco llegó a hablar con nadie", () => {
      const error = new APICallError({
        message: "network error",
        url: "https://generativelanguage.googleapis.com",
        requestBodyValues: {},
      });
      expect(normalizeGeminiError(error)).toBeInstanceOf(AnalysisNetworkError);
    });
  });

  describe("timeout", () => {
    it("el corte de AbortSignal.timeout es un timeout", () => {
      const aborted = new Error("The operation was aborted due to timeout");
      aborted.name = "TimeoutError";
      expect(normalizeGeminiError(aborted)).toBeInstanceOf(AnalysisTimeoutError);
    });

    it("y un AbortError también: quien aborta aquí es el reloj", () => {
      const aborted = new Error("This operation was aborted");
      aborted.name = "AbortError";
      expect(normalizeGeminiError(aborted)).toBeInstanceOf(AnalysisTimeoutError);
    });
  });

  describe("malformada", () => {
    it("el modelo que no consiguió armar el objeto", () => {
      const error = normalizeGeminiError(noObject("lo siento, no puedo"));
      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect(error.retryable).toBe(true);
    });

    /**
     * El criterio del ticket: incumplir un `refine` de #23 sale por el MISMO
     * camino que un JSON corrupto. Aquí se prueba con el error que Zod lanza,
     * que es lo que llega cuando el objeto está bien formado pero es inválido.
     */
    it("un ZodError es malformada, y dice qué regla se incumplió", () => {
      const schema = z.object({ checks: z.array(z.string()).min(1) });
      const result = schema.safeParse({ checks: [] });
      const error = normalizeGeminiError(result.error);

      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain(
        "checks",
      );
    });

    /** El texto que devolvió el modelo es el árbol del usuario masticado. */
    it("nunca se lleva la respuesta del modelo al mensaje ni a los issues", () => {
      const error = normalizeGeminiError(
        noObject("SECRETO DEL USUARIO"),
      ) as MalformedAnalysisError;

      expect(error.message).not.toContain("SECRETO");
      expect(error.issues.join(" ")).not.toContain("SECRETO");
    });
  });

  describe("envoltorios", () => {
    /**
     * El SDK reintenta solo y envuelve el último fallo en un `RetryError`. Sin
     * desenvolverlo, TODO llegaría clasificado como red: un 429 tras tres
     * intentos parecería un cable suelto y la interfaz ofrecería reintentar.
     */
    it("un RetryError se clasifica por el fallo que envuelve", () => {
      const error = normalizeGeminiError(
        new RetryError({
          message: "failed after 3 attempts",
          reason: "maxRetriesExceeded",
          errors: [apiError(500), apiError(429)],
        }),
      );
      expect(error).toBeInstanceOf(QuotaExceededError);
    });

    it("un error ya normalizado se deja tal cual", () => {
      const original = new QuotaExceededError(10);
      expect(normalizeGeminiError(original)).toBe(original);
    });
  });

  /**
   * No hay sexta categoría. Un throw que no encaja en ninguna es un fallo
   * nuestro o del SDK, y sale como red porque es la única de las cinco cuya
   * acción —reintentar— no hace daño si la clasificación estaba mal.
   */
  it("lo que no se sabe clasificar sale como red, no como excepción suelta", () => {
    expect(normalizeGeminiError(new Error("vaya"))).toBeInstanceOf(
      AnalysisNetworkError,
    );
    expect(normalizeGeminiError("una cadena")).toBeInstanceOf(
      AnalysisNetworkError,
    );
  });
});

/**
 * Qué fallo justifica probar el siguiente modelo de la lista.
 *
 * Es la política de la cadena, y se prueba aquí y no en el adaptador porque es
 * una decisión PURA sobre categorías: no necesita red, ni un modelo, ni
 * inventarse errores del SDK.
 */
describe("shouldTryAnotherModel", () => {
  /** El caso que motivó la cadena entera. */
  it("un 503 de «high demand» pasa al siguiente: otro puede no estar saturado", () => {
    expect(shouldTryAnotherModel(normalizeGeminiError(apiError(503)))).toBe(true);
  });

  /** Los límites del free tier son POR MODELO, y un rechazo no gasta cuota. */
  it("un 429 también: la cuota se cuenta por modelo", () => {
    expect(shouldTryAnotherModel(normalizeGeminiError(apiError(429)))).toBe(true);
  });

  /** El caso que el ticket anticipaba, y que pasó con gemini-2.5-flash. */
  it("y un 404: el modelo retirado es justo lo que la lista existe para sobrevivir", () => {
    expect(shouldTryAnotherModel(normalizeGeminiError(apiError(404)))).toBe(true);
  });

  /**
   * Aquí se para, y es la mitad importante de la política. El modelo contestó:
   * gastó tokens y medio minuto, y que se salte la regla de los Checks no da
   * ninguna razón para creer que el siguiente no lo hará. Encadenar sería
   * quemar el presupuesto entero produciendo basura.
   */
  it("una respuesta malformada NO pasa al siguiente: el modelo sí contestó", () => {
    expect(shouldTryAnotherModel(new MalformedAnalysisError(["x: y"]))).toBe(false);
  });

  it("ni un problema de la entrada: ningún modelo arregla un árbol vacío", () => {
    expect(shouldTryAnotherModel(new InvalidAnalysisInputError("vacío"))).toBe(false);
  });

  /**
   * La política, entera y de una vez.
   *
   * Se afirma la PARTICIÓN y no cada caso por separado porque lo que hay que
   * proteger es que la suma cubra la taxonomía: una categoría nueva que nadie
   * clasifique caería en «no pasa al siguiente» por omisión —el `Set` no la
   * tiene— y nadie se enteraría. Aquí la tercera afirmación lo rompe.
   */
  it("parte la taxonomía en dos, y las dos mitades suman el total", () => {
    const oneOfEach: AnalysisError[] = [
      new QuotaExceededError(30),
      new AnalysisTimeoutError(),
      new AnalysisNetworkError(),
      new MalformedAnalysisError(["x: y"]),
      new AnalysisConfigError("falta algo"),
      new SessionRequiredError(),
      new InvalidAnalysisInputError("vacío"),
    ];

    const advance = oneOfEach.filter(shouldTryAnotherModel).map((e) => e.kind);
    const stop = oneOfEach.filter((e) => !shouldTryAnotherModel(e)).map((e) => e.kind);

    expect(advance.sort()).toEqual(["configuracion", "cuota", "red", "timeout"]);
    expect(stop.sort()).toEqual(["entrada", "malformada", "sesion"]);
    expect([...advance, ...stop].sort()).toEqual([...ANALYSIS_ERROR_KINDS].sort());
  });
});
