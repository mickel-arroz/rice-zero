import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnalysisConfigError } from "@/lib/ai/errors";
import {
  AI_PROVIDER_ENV_KEY,
  AI_PROVIDER_NAMES,
  getAnalysisProvider,
  readAnalysisProviderName,
  resetAnalysisProvider,
} from "@/lib/ai/factory";

/**
 * `vitest.setup.ts` fuerza `falso` para toda la corrida, así que estos tests
 * se guardan el valor y lo devuelven: dejar la variable tocada haría que el
 * siguiente archivo de test hablara con Gemini de verdad.
 */
const original = process.env[AI_PROVIDER_ENV_KEY];

beforeEach(() => {
  resetAnalysisProvider();
});

afterEach(() => {
  process.env[AI_PROVIDER_ENV_KEY] = original;
  resetAnalysisProvider();
});

describe("la fábrica del Proveedor de IA", () => {
  it("con `falso` da el proveedor que no llama a nadie", () => {
    process.env[AI_PROVIDER_ENV_KEY] = "falso";
    expect(getAnalysisProvider().name).toBe("falso");
  });

  /**
   * El criterio del ticket: intercambiables sin tocar nada fuera de aquí. Se
   * afirma cambiando SOLO la variable y viendo que sale el otro adaptador.
   */
  it("con `gemini` da el adaptador de Gemini, y nada más cambia", () => {
    process.env[AI_PROVIDER_ENV_KEY] = "gemini";
    expect(getAnalysisProvider().name).toBe("gemini");
  });

  it("los dos cumplen el puerto: se identifican con nombre y modelo", () => {
    for (const name of AI_PROVIDER_NAMES) {
      process.env[AI_PROVIDER_ENV_KEY] = name;
      resetAnalysisProvider();
      const provider = getAnalysisProvider();
      expect(provider.model.trim().length).toBeGreaterThan(0);
      expect(typeof provider.analyze).toBe("function");
    }
  });

  describe("no elige por su cuenta", () => {
    /**
     * Sin default a `falso`, y es la decisión importante de este archivo: un
     * despliegue al que se le olvidó la variable serviría Análisis inventados
     * por un proveedor de mentira, y nadie se enteraría. Fallar es lo único
     * que se nota.
     */
    it("sin la variable, se rinde en vez de caer al falso", () => {
      delete process.env[AI_PROVIDER_ENV_KEY];
      expect(() => getAnalysisProvider()).toThrow(AnalysisConfigError);
    });

    it("y dice qué variable falta", () => {
      delete process.env[AI_PROVIDER_ENV_KEY];
      const error = (() => {
        try {
          readAnalysisProviderName();
          return null;
        } catch (e) {
          return e as AnalysisConfigError;
        }
      })();
      expect(error?.key).toBe(AI_PROVIDER_ENV_KEY);
      expect(error?.retryable).toBe(false);
    });

    it("un nombre inventado tampoco cae a un default", () => {
      process.env[AI_PROVIDER_ENV_KEY] = "chatgpt";
      expect(() => getAnalysisProvider()).toThrow(AnalysisConfigError);
    });

    it("y el error enumera los que sí hay", () => {
      process.env[AI_PROVIDER_ENV_KEY] = "chatgpt";
      const error = (() => {
        try {
          readAnalysisProviderName();
          return null;
        } catch (e) {
          return e as AnalysisConfigError;
        }
      })();
      for (const name of AI_PROVIDER_NAMES) {
        expect(error?.message).toContain(name);
      }
    });

    it("un valor en blanco es no haberla puesto", () => {
      process.env[AI_PROVIDER_ENV_KEY] = "   ";
      expect(() => readAnalysisProviderName()).toThrow(AnalysisConfigError);
    });
  });

  describe("memoización", () => {
    it("el proveedor se construye una vez", () => {
      process.env[AI_PROVIDER_ENV_KEY] = "falso";
      expect(getAnalysisProvider()).toBe(getAnalysisProvider());
    });

    it("y `reset` obliga a releer el interruptor", () => {
      process.env[AI_PROVIDER_ENV_KEY] = "falso";
      const first = getAnalysisProvider();

      process.env[AI_PROVIDER_ENV_KEY] = "gemini";
      expect(getAnalysisProvider()).toBe(first);

      resetAnalysisProvider();
      expect(getAnalysisProvider().name).toBe("gemini");
    });
  });
});
