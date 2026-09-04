/**
 * La contract suite del Proveedor de IA.
 *
 * Una sola, compartida por todos los adaptadores, igual que la del Proveedor
 * de Backend. Lo que dice es «esto es lo que significa ser un Proveedor de IA
 * de RICE(0)», así que el adaptador de Gemini (#15) se considera terminado
 * cuando la pasa entera y no antes.
 *
 * Solo habla el vocabulario del puerto. Ni una mención a un SDK, a una API key
 * ni a un formato de respuesta: si un test de aquí necesitara saber de eso, el
 * puerto estaría mal.
 *
 * Corre contra el proveedor falso dentro de `npm test` y correría contra
 * Gemini en un `.live.test.ts`, que `vitest.config.ts` excluye de la corrida
 * normal. Por eso la suite afirma propiedades y no textos concretos: un modelo
 * de verdad no escribe dos veces la misma frase.
 */

import { describe, expect, it } from "vitest";

import type { AnalysisProvider } from "@/lib/ai/port";
import { analysisSchema, INTENT_KINDS } from "@/lib/ai/schema";
import { SAMPLE_TREES } from "@/lib/ai/testing/samples";
import { serializeTree } from "@/lib/tree/serialize";

export type AnalysisContractHarness = {
  /** Nombre del adaptador, para el nombre del `describe`. */
  name: string;
  /** Un proveedor listo para analizar. */
  provider(): AnalysisProvider;
};

export function describeAnalysisContract(harness: AnalysisContractHarness): void {
  describe(`Proveedor de IA: ${harness.name}`, () => {
    it("devuelve un Análisis que pasa el schema", async () => {
      const { analysis } = await harness.provider().analyze({
        serializedTree: serializeTree(SAMPLE_TREES.feature),
      });
      expect(analysisSchema.safeParse(analysis).success).toBe(true);
    });

    /**
     * El criterio que justifica el ADR 0003 entero.
     *
     * No se afirma que acierte el `kind` exacto —eso es calidad del modelo y un
     * test no lo puede fijar sin volverse frágil—: se afirma lo que sí es un
     * fallo de contrato, que un árbol que habla de algo YA EXISTENTE salga
     * clasificado como si hubiera que crearlo desde cero.
     */
    describe("la Intención no da por supuesto que el árbol sea un proyecto nuevo", () => {
      for (const kind of INTENT_KINDS) {
        if (kind === "proyecto-nuevo") continue;

        it(`un árbol de tipo «${kind}» no sale como proyecto-nuevo`, async () => {
          const { analysis } = await harness.provider().analyze({
            serializedTree: serializeTree(SAMPLE_TREES[kind]),
          });
          expect(analysis.intent.kind).not.toBe("proyecto-nuevo");
        });
      }

      it("un árbol que sí arranca de cero sale como proyecto-nuevo", async () => {
        const { analysis } = await harness.provider().analyze({
          serializedTree: serializeTree(SAMPLE_TREES["proyecto-nuevo"]),
        });
        expect(analysis.intent.kind).toBe("proyecto-nuevo");
      });

      it("siempre razona la Intención: sin porqué no se puede corregir", async () => {
        const { analysis } = await harness.provider().analyze({
          serializedTree: serializeTree(SAMPLE_TREES.fix),
        });
        expect(analysis.intent.rationale.trim().length).toBeGreaterThan(0);
      });
    });

    it("las Directrices del Usuario ganan a la deducción", async () => {
      const { analysis } = await harness.provider().analyze({
        serializedTree: serializeTree(SAMPLE_TREES["proyecto-nuevo"]),
        guidelines: "Ignora el árbol: esto es documentar la API ya publicada.",
      });
      expect(analysis.intent.kind).toBe("docs");
    });

    /** El criterio del ticket: ningún Nodo se queda fuera del trabajo. */
    it("todo Nodo del árbol queda representado en algún Ticket o Check", async () => {
      const { analysis } = await harness.provider().analyze({
        serializedTree: serializeTree(SAMPLE_TREES.feature),
      });

      const covered = analysis.tickets
        .flatMap((ticket) => [ticket.title, ticket.build, ...ticket.checks])
        .join("\n")
        .toLowerCase();

      for (const { content: text } of SAMPLE_TREES.feature) {
        expect(covered, `El Nodo «${text}» no aparece en ningún Ticket`).toContain(
          text.toLowerCase(),
        );
      }
    });

    it("ningún Ticket llega sin Checks", async () => {
      const { analysis } = await harness.provider().analyze({
        serializedTree: serializeTree(SAMPLE_TREES.refactor),
      });
      for (const ticket of analysis.tickets) {
        expect(ticket.checks.length).toBeGreaterThan(0);
      }
    });

    it("los bloqueos apuntan a Tickets que existen", async () => {
      const { analysis } = await harness.provider().analyze({
        serializedTree: serializeTree(SAMPLE_TREES["proyecto-nuevo"]),
      });
      const ids = new Set(analysis.tickets.map((ticket) => ticket.id));
      for (const ticket of analysis.tickets) {
        for (const blocker of ticket.blockedBy) expect(ids.has(blocker)).toBe(true);
      }
    });

    describe("se identifica: el Análisis se guarda diciendo quién y con qué", () => {
      it("tiene nombre y al menos un modelo", () => {
        const provider = harness.provider();
        expect(provider.name.trim().length).toBeGreaterThan(0);
        expect(provider.models.length).toBeGreaterThan(0);
        for (const model of provider.models) {
          expect(model.trim().length).toBeGreaterThan(0);
        }
      });

      /**
       * Y dice cuál contestó DE VERDAD, no cuál prefería.
       *
       * Es lo que distingue este contrato del de antes, cuando el modelo era un
       * campo fijo del proveedor. Con una cadena de reserva, devolver el
       * preferido en vez del que respondió guardaría una provenance falsa en
       * `ai_analyses.model` sin que nada fallara — y ese campo existe
       * precisamente porque los modelos cambian.
       */
      it("y devuelve, con cada Análisis, el modelo que lo escribió", async () => {
        const provider = harness.provider();
        const { model } = await provider.analyze({
          serializedTree: serializeTree(SAMPLE_TREES.feature),
        });

        expect(model.trim().length).toBeGreaterThan(0);
        expect(provider.models).toContain(model);
      });
    });
  });
}
