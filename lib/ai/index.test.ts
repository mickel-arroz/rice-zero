/**
 * Qué deja pasar la puerta de la capa de IA, y sobre todo qué NO.
 *
 * Existe por un agujero concreto en el criterio «la API key no aparece en
 * ningún bundle de cliente». Ese criterio se sostiene sobre tres cosas:
 *
 *   1. `import "server-only"` en el adaptador y en la fábrica.
 *   2. Las reglas de ESLint que prohíben el SDK fuera de su adaptador.
 *   3. Que `lib/ai/index.ts` NO reexporte ni la fábrica ni el adaptador.
 *
 * Las dos primeras las enforcea algo: el build de Next y el linter. La TERCERA
 * no la enforceaba nada — y es la más fácil de romper por accidente, porque el
 * archivo es una lista de `export *` y añadir una línea más parece inocuo. Un
 * `export * from "@/lib/ai/factory"` arrastraría `@ai-sdk/google` y la lectura
 * de la API key a cualquier componente de cliente que use el renderer, y el
 * `server-only` de la fábrica convertiría eso en un build roto: el fallo
 * llegaría, pero al final y sin decir de dónde viene.
 *
 * Además, `vitest.server-only.ts` deja `server-only` en un módulo vacío para
 * que los tests puedan cargar módulos de servidor, así que dentro de Vitest esa
 * marca no protege de nada. Este archivo es lo que sí puede fallar aquí.
 */

import { describe, expect, it } from "vitest";

import * as ai from "@/lib/ai";

describe("la puerta de lib/ai", () => {
  it("deja pasar el contrato entero: schema, prompt, render y errores", () => {
    const exported = Object.keys(ai);

    for (const name of [
      "analysisSchema",
      "INTENT_KINDS",
      "buildAnalysisPrompt",
      "renderMasterPrompt",
      "renderTicketPrompt",
      "ANALYSIS_ERROR_KINDS",
      "describeAnalysisFailure",
    ]) {
      expect(exported, `${name} tendría que salir por la puerta`).toContain(name);
    }
  });

  /**
   * Y NO deja pasar nada que lea credenciales. Se comprueba por nombre porque
   * es lo que un `export *` de más traería: los símbolos de esos módulos.
   */
  it("no deja pasar la fábrica ni el adaptador de Gemini", () => {
    const exported = Object.keys(ai);

    for (const name of [
      "getAnalysisProvider",
      "resetAnalysisProvider",
      "readAnalysisProviderName",
      "AI_PROVIDER_ENV_KEY",
      "createGeminiProvider",
      "requireApiKey",
      "normalizeGeminiError",
      "GEMINI_API_KEY_ENV",
    ]) {
      expect(exported, `${name} NO puede salir por la puerta`).not.toContain(name);
    }
  });

  /**
   * El proveedor falso tampoco, y no por seguridad: por honestidad. Es soporte
   * de tests, y una app que pudiera pedirlo desde la puerta principal tendría
   * dos formas de conseguir un Proveedor de IA — la fábrica y un atajo— con lo
   * que «un solo interruptor» dejaría de ser verdad.
   */
  it("ni el proveedor falso: quien elige proveedor es la fábrica", () => {
    expect(Object.keys(ai)).not.toContain("fakeAnalysisProvider");
  });
});
