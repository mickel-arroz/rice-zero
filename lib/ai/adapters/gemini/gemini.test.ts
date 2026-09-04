/**
 * El adaptador de Gemini, sin salir a la red.
 *
 * Todo lo de aquí pasa por `analyze()` de punta a punta con un doble en el
 * único punto que habla con Google. Es lo que hace verificable el criterio del
 * ticket —«mapeo de 429 / timeout / red / malformada verificado con proveedor
 * falso»— sin gastar una petición de cuota: los mismos errores que armaría el
 * SDK, entregados a mano.
 *
 * Lo que NO se prueba aquí es la CALIDAD del Análisis: que la Intención salga
 * bien, que ningún Nodo se quede fuera. Eso es la contract suite, y contra
 * Gemini corre en `gemini.live.test.ts`, que `npm test` excluye.
 */

import { APICallError } from "ai";
import { describe, expect, it, vi } from "vitest";

import {
  createGeminiProvider,
  requireApiKey,
  type GenerateAnalysisObject,
} from "@/lib/ai/adapters/gemini";
import {
  AnalysisConfigError,
  AnalysisNetworkError,
  AnalysisTimeoutError,
  MalformedAnalysisError,
  QuotaExceededError,
} from "@/lib/ai/errors";
import { sampleAnalysis, SAMPLE_TREES } from "@/lib/ai/testing/samples";
import { serializeTree } from "@/lib/tree/serialize";

/** Un adaptador cuyo modelo devuelve exactamente esto. */
function respondingWith(object: unknown) {
  const generate = vi.fn<GenerateAnalysisObject>(async () => object);
  return { provider: createGeminiProvider(generate), generate };
}

/** Un adaptador cuyo modelo revienta exactamente así. */
function failingWith(error: unknown) {
  return createGeminiProvider(async () => {
    throw error;
  });
}

const REQUEST = { serializedTree: serializeTree(SAMPLE_TREES.feature) };

describe("el adaptador de Gemini", () => {
  it("se identifica con el nombre y el modelo que se guardan con el Análisis", () => {
    const provider = createGeminiProvider(async () => sampleAnalysis());
    expect(provider.name).toBe("gemini");
    expect(provider.model.trim().length).toBeGreaterThan(0);
  });

  it("devuelve el Análisis validado que dio el modelo", async () => {
    const { provider } = respondingWith(sampleAnalysis());
    const analysis = await provider.analyze(REQUEST);
    expect(analysis.intent.kind).toBe(sampleAnalysis().intent.kind);
    expect(analysis.tickets).toHaveLength(3);
  });

  /**
   * El adaptador no re-serializa el árbol ni escribe reglas propias: manda el
   * prompt que ensambla `lib/ai/prompt.ts`. Se comprueba mirando que por el
   * cable van las dos cosas que ese módulo mete y este archivo no conoce.
   */
  it("manda el prompt ensamblado, con el árbol tal cual y las Directrices", async () => {
    const { provider, generate } = respondingWith(sampleAnalysis());
    await provider.analyze({ ...REQUEST, guidelines: "Sé escueto." });

    const prompt = generate.mock.calls[0][0];
    expect(prompt).toContain(REQUEST.serializedTree);
    expect(prompt).toContain("Sé escueto.");
  });

  describe("una respuesta malformada nunca cruza el puerto", () => {
    it("un JSON que no es ni un objeto", async () => {
      const { provider } = respondingWith("lo siento, no puedo ayudarte");
      await expect(provider.analyze(REQUEST)).rejects.toThrow(
        MalformedAnalysisError,
      );
    });

    /**
     * EL criterio del ticket. Un Ticket sin Checks es un objeto perfectamente
     * bien formado: pasa cualquier JSON.parse y cualquier JSON Schema que el
     * SDK le haya mandado al modelo. Lo único que lo rechaza es el `refine` de
     * #23, y tiene que rechazarlo por el MISMO camino que la basura de arriba.
     */
    it("un Ticket sin Checks, por el mismo camino que un JSON corrupto", async () => {
      const analysis = sampleAnalysis();
      analysis.tickets[1].checks = [];

      const { provider } = respondingWith(analysis);
      const error = await provider.analyze(REQUEST).catch((e) => e);

      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain(
        "checks",
      );
    });

    it("un ciclo de bloqueos", async () => {
      const analysis = sampleAnalysis();
      analysis.tickets[0].blockedBy = ["t3"];

      const { provider } = respondingWith(analysis);
      const error = await provider.analyze(REQUEST).catch((e) => e);

      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain(
        "tickets",
      );
    });

    it("un bloqueo que apunta a un Ticket que no existe", async () => {
      const analysis = sampleAnalysis();
      analysis.tickets[2].blockedBy = ["t99"];

      const { provider } = respondingWith(analysis);
      await expect(provider.analyze(REQUEST)).rejects.toThrow(
        MalformedAnalysisError,
      );
    });

    it("una Intención que no está en el enum", async () => {
      const analysis = { ...sampleAnalysis(), intent: { kind: "epic", rationale: "x" } };
      const { provider } = respondingWith(analysis);
      await expect(provider.analyze(REQUEST)).rejects.toThrow(
        MalformedAnalysisError,
      );
    });

    it("un Análisis sin ni un Ticket", async () => {
      const { provider } = respondingWith({ ...sampleAnalysis(), tickets: [] });
      await expect(provider.analyze(REQUEST)).rejects.toThrow(
        MalformedAnalysisError,
      );
    });
  });

  describe("los fallos del proveedor llegan clasificados", () => {
    it("cuota agotada", async () => {
      const provider = failingWith(
        new APICallError({
          message: "Resource has been exhausted",
          url: "https://generativelanguage.googleapis.com",
          requestBodyValues: {},
          statusCode: 429,
        }),
      );
      await expect(provider.analyze(REQUEST)).rejects.toThrow(QuotaExceededError);
    });

    it("timeout", async () => {
      const aborted = new Error("aborted");
      aborted.name = "TimeoutError";
      await expect(failingWith(aborted).analyze(REQUEST)).rejects.toThrow(
        AnalysisTimeoutError,
      );
    });

    it("red", async () => {
      await expect(
        failingWith(new TypeError("fetch failed")).analyze(REQUEST),
      ).rejects.toThrow(AnalysisNetworkError);
    });

    it("el modelo retirado sale como configuración, no como red", async () => {
      const provider = failingWith(
        new APICallError({
          message: "models/gemini-vieja is not found",
          url: "https://generativelanguage.googleapis.com",
          requestBodyValues: {},
          statusCode: 404,
        }),
      );
      await expect(provider.analyze(REQUEST)).rejects.toThrow(AnalysisConfigError);
    });
  });

  describe("la API key", () => {
    it("sin ella, es un fallo de configuración que dice cuál falta", () => {
      const error = (() => {
        try {
          requireApiKey(undefined);
          return null;
        } catch (e) {
          return e;
        }
      })();

      expect(error).toBeInstanceOf(AnalysisConfigError);
      expect((error as AnalysisConfigError).key).toBe("GEMINI_API_KEY");
      expect((error as AnalysisConfigError).retryable).toBe(false);
    });

    it("un valor en blanco es no tenerla", () => {
      expect(() => requireApiKey("   ")).toThrow(AnalysisConfigError);
    });

    /**
     * Pegar una clave desde la consola de Google se lleva un salto de línea
     * detrás más veces de las que parece, y el SDK lo mandaría en la cabecera
     * `Authorization` tal cual — un 401 sin ninguna pista de por qué.
     */
    it("se recorta lo que se pegó de más alrededor", () => {
      expect(requireApiKey("  AIzaEjemplo\n")).toBe("AIzaEjemplo");
    });
  });
});
