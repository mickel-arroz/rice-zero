import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeGeminiError } from "@/lib/ai/adapters/gemini/errors";
import {
  AnalysisConfigError,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
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
