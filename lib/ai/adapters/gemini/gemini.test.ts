/**
 * El adaptador de Gemini, sin salir a la red.
 *
 * Todo lo de aquí pasa por `analyze()` de punta a punta con un doble en el
 * único punto que habla con Google. Es lo que hace verificable el criterio del
 * ticket —«mapeo de 429 / timeout / red / malformada verificado con proveedor
 * falso»— sin gastar una petición de cuota: los mismos errores que armaría el
 * SDK, entregados a mano.
 *
 * Y desde que hay cadena de reserva, es también lo que la hace probable. El
 * doble recibe el MODELO y el PRESUPUESTO como parámetros, así que un test
 * puede afirmar en qué orden se intentaron los modelos y con cuánto tiempo —lo
 * único que de verdad hay que probar de una cadena.
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
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
} from "@/lib/ai/errors";
import { sampleAnalysis, SAMPLE_TREES } from "@/lib/ai/testing/samples";
import { AI_CONFIG } from "@/lib/constants";
import { serializeTree } from "@/lib/tree/serialize";

/** Un adaptador cuyo modelo devuelve exactamente esto, al primer intento. */
function respondingWith(object: unknown) {
  const generate = vi.fn<GenerateAnalysisObject>(async () => object);
  return { provider: createGeminiProvider(generate), generate };
}

/** Un adaptador en el que TODOS los modelos revientan exactamente así. */
function failingWith(error: unknown) {
  const generate = vi.fn<GenerateAnalysisObject>(async () => {
    throw error;
  });
  return { provider: createGeminiProvider(generate), generate };
}

/**
 * Un adaptador en el que los primeros `n` modelos fallan y el siguiente
 * contesta. Es el doble que hace probable la cadena sin gastar cuota.
 */
function failingFirst(n: number, error: unknown, object: unknown = sampleAnalysis()) {
  let calls = 0;
  const generate = vi.fn<GenerateAnalysisObject>(async () => {
    calls += 1;
    if (calls <= n) throw error;
    return object;
  });
  return { provider: createGeminiProvider(generate), generate };
}

/** Un `APICallError` como el que arma el SDK al recibir una respuesta HTTP. */
function apiError(statusCode: number, message = `HTTP ${statusCode}`): APICallError {
  return new APICallError({
    message,
    url: "https://generativelanguage.googleapis.com",
    requestBodyValues: {},
    statusCode,
  });
}

/** El 503 con el que Gemini dice que un modelo está saturado. */
function highDemand(): APICallError {
  return apiError(503, "This model is currently experiencing high demand.");
}

/** Los modelos que el doble recibió, en orden. */
function triedModels(generate: ReturnType<typeof vi.fn<GenerateAnalysisObject>>) {
  return generate.mock.calls.map(([, model]) => model);
}

const REQUEST = { serializedTree: serializeTree(SAMPLE_TREES.feature) };

describe("el adaptador de Gemini", () => {
  it("se identifica con el nombre y la lista de modelos", () => {
    const provider = createGeminiProvider(async () => sampleAnalysis());
    expect(provider.name).toBe("gemini");
    expect(provider.models.length).toBeGreaterThan(0);
  });

  it("devuelve el Análisis validado que dio el modelo", async () => {
    const { provider } = respondingWith(sampleAnalysis());
    const { analysis } = await provider.analyze(REQUEST);
    expect(analysis.intent.kind).toBe(sampleAnalysis().intent.kind);
    expect(analysis.tickets).toHaveLength(3);
  });

  /**
   * Y dice CUÁL contestó. Con cadena de reserva eso deja de ser deducible del
   * proveedor, y es lo que acaba en `ai_analyses.model`.
   */
  it("dice qué modelo lo escribió: el preferido, si contestó", async () => {
    const { provider } = respondingWith(sampleAnalysis());
    const { model } = await provider.analyze(REQUEST);
    expect(model).toBe(provider.models[0]);
  });

  /**
   * El adaptador no re-serializa el árbol ni escribe reglas propias: manda el
   * prompt que ensambla `lib/ai/prompt.ts`. Se comprueba mirando que por el
   * cable van las dos cosas que ese módulo mete y este archivo no conoce.
   */
  it("manda el prompt ensamblado, con el árbol tal cual y las Directrices", async () => {
    const { provider, generate } = respondingWith(sampleAnalysis());
    await provider.analyze({ ...REQUEST, guidelines: "Sé escueto." });

    const [prompt] = generate.mock.calls[0];
    expect(prompt).toContain(REQUEST.serializedTree);
    expect(prompt).toContain("Sé escueto.");
  });

  /**
   * La cadena de reserva.
   *
   * Existe porque el free tier se congestiona de verdad: el 2026-09-04, tres de
   * los cuatro Flash de la lista contestaban `503 — high demand` a la vez, y
   * una generación se perdía entera teniendo otros modelos libres.
   */
  describe("la cadena de reserva", () => {
    it("un modelo saturado no hunde la generación: la sigue el siguiente", async () => {
      const { provider, generate } = failingFirst(1, highDemand());

      const { model } = await provider.analyze(REQUEST);

      expect(generate).toHaveBeenCalledTimes(2);
      expect(model).toBe(provider.models[1]);
    });

    it("respeta el orden de preferencia, sin saltarse ninguno", async () => {
      const { provider, generate } = failingFirst(3, highDemand());

      const { model } = await provider.analyze(REQUEST);

      expect(triedModels(generate)).toEqual(provider.models.slice(0, 4));
      expect(model).toBe(provider.models[3]);
    });

    it("y el Análisis que devuelve es el del que contestó", async () => {
      const mine = sampleAnalysis();
      mine.summary = "Lo escribió el de reserva";
      const { provider } = failingFirst(2, highDemand(), mine);

      const { analysis } = await provider.analyze(REQUEST);

      expect(analysis.summary).toBe("Lo escribió el de reserva");
    });

    it("lo intenta con todos antes de rendirse", async () => {
      const { provider, generate } = failingWith(highDemand());

      await provider.analyze(REQUEST).catch(() => {});

      expect(triedModels(generate)).toEqual([...provider.models]);
    });

    it("y si todos fallan, se rinde con el último fallo clasificado", async () => {
      const { provider } = failingWith(highDemand());

      const error = await provider.analyze(REQUEST).catch((e) => e);

      expect(error).toBeInstanceOf(AnalysisNetworkError);
      expect(error.retryable).toBe(true);
    });

    /** Los límites del free tier son por modelo, y un rechazo no gasta cuota. */
    it("una cuota agotada también pasa al siguiente", async () => {
      const { provider, generate } = failingFirst(1, apiError(429));

      await provider.analyze(REQUEST);

      expect(generate).toHaveBeenCalledTimes(2);
    });

    /** El caso que el ticket anticipaba, y que pasó con gemini-2.5-flash. */
    it("y un modelo retirado: es justo para lo que la lista existe", async () => {
      const { provider, generate } = failingFirst(1, apiError(404));

      await provider.analyze(REQUEST);

      expect(generate).toHaveBeenCalledTimes(2);
    });

    /**
     * La mitad importante de la política: aquí NO se encadena. El modelo
     * contestó —gastó tokens y, si razona, medio minuto— y que se salte la
     * regla de los Checks no da ninguna razón para creer que el siguiente no lo
     * hará. Encadenar sería quemar el presupuesto produciendo basura.
     */
    it("una respuesta malformada NO pasa al siguiente modelo", async () => {
      const broken = sampleAnalysis();
      broken.tickets[0].checks = [];
      const { provider, generate } = respondingWith(broken);

      await expect(provider.analyze(REQUEST)).rejects.toThrow(MalformedAnalysisError);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it("ni un problema de la entrada: ningún modelo arregla eso", async () => {
      const { provider, generate } = failingWith(apiError(400, "prompt too long"));

      await expect(provider.analyze(REQUEST)).rejects.toThrow(InvalidAnalysisInputError);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    /**
     * El presupuesto es de la generación ENTERA y no de cada intento: cinco
     * modelos a dos minutos serían diez minutos de peor caso, por encima de
     * cualquier `maxDuration` de plataforma.
     */
    it("cada intento recibe lo que QUEDA, nunca más que el total", async () => {
      const { provider, generate } = failingFirst(2, highDemand());

      await provider.analyze(REQUEST);

      const budgets = generate.mock.calls.map(([, , ms]) => ms);
      expect(budgets[0]).toBeLessThanOrEqual(AI_CONFIG.timeoutMs);
      expect(budgets[1]).toBeLessThanOrEqual(budgets[0]);
      expect(budgets[2]).toBeLessThanOrEqual(budgets[1]);
    });

    /**
     * Y se para ANTES de llamar cuando lo que queda no da para un Análisis.
     *
     * Con reloj falso porque es la única forma de llegar a esa rama sin esperar
     * dos minutos de verdad: el doble se come el presupuesto entero y falla de
     * forma encadenable, así que sin el corte la cadena lanzaría un segundo
     * intento con cero tiempo — garantizado a morir, y contado por Google
     * igual que cualquier otro. Cuota tirada a cambio de nada.
     */
    it("no gasta una llamada que no puede llegar a tiempo", async () => {
      vi.useFakeTimers();
      try {
        const generate = vi.fn<GenerateAnalysisObject>(async () => {
          vi.advanceTimersByTime(AI_CONFIG.timeoutMs);
          throw highDemand();
        });
        const provider = createGeminiProvider(generate);

        const error = await provider.analyze(REQUEST).catch((e) => e);

        // Un timeout y no el 503: si se acabó el reloj, eso es lo que pasó.
        // Decir «high demand» mandaría a mirar al sitio equivocado.
        expect(error).toBeInstanceOf(AnalysisTimeoutError);
        expect(generate).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    /** Pero el 503 no se pierde: viaja en `cause` para quien mire el log. */
    it("y el fallo que se vio de camino queda en la causa", async () => {
      vi.useFakeTimers();
      try {
        const original = highDemand();
        const provider = createGeminiProvider(async () => {
          vi.advanceTimersByTime(AI_CONFIG.timeoutMs);
          throw original;
        });

        const error = await provider.analyze(REQUEST).catch((e) => e);

        expect((error as AnalysisTimeoutError).cause).toBeInstanceOf(AnalysisNetworkError);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("una respuesta malformada nunca cruza el puerto", () => {
    it("un JSON que no es ni un objeto", async () => {
      const { provider } = respondingWith("lo siento, no puedo ayudarte");
      await expect(provider.analyze(REQUEST)).rejects.toThrow(MalformedAnalysisError);
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
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain("checks");
    });

    it("un ciclo de bloqueos", async () => {
      const analysis = sampleAnalysis();
      analysis.tickets[0].blockedBy = ["t3"];

      const { provider } = respondingWith(analysis);
      const error = await provider.analyze(REQUEST).catch((e) => e);

      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain("tickets");
    });

    it("un bloqueo que apunta a un Ticket que no existe", async () => {
      const analysis = sampleAnalysis();
      analysis.tickets[2].blockedBy = ["t99"];

      const { provider } = respondingWith(analysis);
      await expect(provider.analyze(REQUEST)).rejects.toThrow(MalformedAnalysisError);
    });

    it("una Intención que no está en el enum", async () => {
      const analysis = { ...sampleAnalysis(), intent: { kind: "epic", rationale: "x" } };
      const { provider } = respondingWith(analysis);
      await expect(provider.analyze(REQUEST)).rejects.toThrow(MalformedAnalysisError);
    });

    it("un Análisis sin ni un Ticket", async () => {
      const { provider } = respondingWith({ ...sampleAnalysis(), tickets: [] });
      await expect(provider.analyze(REQUEST)).rejects.toThrow(MalformedAnalysisError);
    });
  });

  describe("los fallos del proveedor llegan clasificados", () => {
    it("cuota agotada", async () => {
      const { provider } = failingWith(apiError(429, "Resource has been exhausted"));
      await expect(provider.analyze(REQUEST)).rejects.toThrow(QuotaExceededError);
    });

    it("timeout", async () => {
      const aborted = new Error("aborted");
      aborted.name = "TimeoutError";
      const { provider } = failingWith(aborted);
      await expect(provider.analyze(REQUEST)).rejects.toThrow(AnalysisTimeoutError);
    });

    it("red", async () => {
      const { provider } = failingWith(new TypeError("fetch failed"));
      await expect(provider.analyze(REQUEST)).rejects.toThrow(AnalysisNetworkError);
    });

    it("la API key mala sale como configuración, no como red", async () => {
      const { provider } = failingWith(apiError(401, "API key not valid"));
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
