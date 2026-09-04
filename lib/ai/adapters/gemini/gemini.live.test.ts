/**
 * Gemini de verdad, contra el free tier.
 *
 * Es el último criterio de aceptación del #15, y el único que ningún doble
 * puede sustituir: «generación real de punta a punta con DOS árboles, uno que
 * describe un proyecto desde cero y otro que describe un arreglo sobre algo ya
 * desplegado, y la `intent.kind` deducida tiene que diferir entre ambos».
 *
 * Lo lanza `npm run ai:live`, nunca `npm test`. `vitest.config.ts` excluye los
 * `*.live.test.ts` y `vitest.setup.ts` fuerza además `AI_PROVIDER=falso`, así
 * que ninguna corrida automática puede llegar aquí ni gastar cuota.
 *
 * Construye el adaptador DIRECTAMENTE en vez de pedirlo a la fábrica, y por eso
 * mismo: la fábrica lee `AI_PROVIDER`, que el setup fuerza a `falso`. Saltársela
 * es lo que permite que ese forzado sea absoluto sin dejar sin probar al
 * proveedor de verdad.
 *
 * ## Qué se afirma aquí, y qué no
 *
 * Lo que NO se afirma es nada que el schema ya garantice. Si `analyze()`
 * devolvió, el `.parse` del adaptador pasó, y con él `checks.min(1)`,
 * `tickets.min(1)`, el `refine` del grafo de bloqueos y el `trim().min(1)` de
 * cada texto. Un `expect(ticket.checks.length).toBeGreaterThan(0)` sobre una
 * respuesta ya validada no puede fallar nunca: no es un test, es ruido que
 * parece cobertura.
 *
 * Lo que sí se afirma es lo que el schema NO puede: qué Intención dedujo, que
 * las Directrices le ganan, en qué idioma escribió, y que el renderer aguanta
 * el adorno que un modelo real mete de verdad.
 *
 * La contract suite entera (`describeAnalysisContract`) corre solo con
 * `AI_LIVE_CONTRACT=1`. Son doce llamadas seguidas y el free tier las corta por
 * límite de peticiones por minuto, así que por defecto un 429 haría parecer
 * roto un adaptador que funciona. Ahí está, y se pide a mano.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { createGeminiProvider } from "@/lib/ai/adapters/gemini";
import { renderMasterPrompt } from "@/lib/ai/render";
import type { Analysis } from "@/lib/ai/schema";
import { describeAnalysisContract } from "@/lib/ai/testing/contract";
import { assertPlainText } from "@/lib/ai/testing/plain";
import { SAMPLE_TREES } from "@/lib/ai/testing/samples";
import { serializeTree } from "@/lib/tree/serialize";

/**
 * Dos llaves, y las dos a mano.
 *
 * `AI_LIVE=1` va aparte de la API key por lo mismo que
 * `BACKEND_CONTRACT_LIVE`: una credencial que está en `.env.local` porque el
 * panel la necesita en desarrollo no debe bastar para que un `vitest run`
 * despistado se coma la cuota del día.
 */
const ENABLED =
  process.env.AI_LIVE?.trim() === "1" && Boolean(process.env.GEMINI_API_KEY?.trim());

/** La suite entera, doce llamadas. Se pide aparte. */
const CONTRACT = ENABLED && process.env.AI_LIVE_CONTRACT?.trim() === "1";

/** El árbol que arranca de cero. */
const FROM_SCRATCH = serializeTree(SAMPLE_TREES["proyecto-nuevo"]);

/** El árbol que arregla algo que ya está desplegado. */
const ON_DEPLOYED = serializeTree(SAMPLE_TREES.fix);

describe.skipIf(!ENABLED)("el Proveedor de IA sobre Gemini, en vivo", () => {
  const provider = createGeminiProvider();

  let fromScratch: Analysis;
  let onDeployed: Analysis;
  let guided: Analysis;
  /** Qué modelo de la cadena contestó de verdad. Va al volcado del issue. */
  let usedModels: string[];

  beforeAll(async () => {
    // En serie y no con `Promise.all`: el free tier limita las peticiones por
    // minuto, y tres a la vez es la forma más rápida de ganarse un 429 que no
    // dice nada del adaptador.
    const first = await provider.analyze({ serializedTree: FROM_SCRATCH });
    const second = await provider.analyze({ serializedTree: ON_DEPLOYED });
    const third = await provider.analyze({
      serializedTree: FROM_SCRATCH,
      guidelines: "Ignora el árbol: esto es documentar la API ya publicada.",
    });

    fromScratch = first.analysis;
    onDeployed = second.analysis;
    guided = third.analysis;
    usedModels = [first.model, second.model, third.model];

    /**
     * El volcado para pegar en el issue.
     *
     * El criterio pide «verificación manual DOCUMENTADA en este issue», así que
     * la corrida imprime lo que hay que documentar en vez de dejar a quien la
     * lance sacándolo del reporte de vitest. Solo la Intención y su porqué: el
     * Análisis entero es el árbol de alguien masticado.
     */
    console.log(
      [
        "",
        `Preferencia: ${provider.models.join(" -> ")}`,
        `Contestaron:  ${usedModels.join(", ")}`,
        `Proyecto desde cero   -> ${fromScratch.intent.kind}: ${fromScratch.intent.rationale}`,
        `Arreglo ya desplegado -> ${onDeployed.intent.kind}: ${onDeployed.intent.rationale}`,
        `Con Directrices       -> ${guided.intent.kind}: ${guided.intent.rationale}`,
        `Tickets: ${fromScratch.tickets.length} / ${onDeployed.tickets.length} / ${guided.tickets.length}`,
        "",
      ].join("\n"),
    );
  }, 240_000);

  describe("la Intención se deduce del árbol", () => {
    /** EL criterio del ticket, dicho tal cual. */
    it("las dos Intenciones difieren entre los dos árboles", () => {
      expect(fromScratch.intent.kind).not.toBe(onDeployed.intent.kind);
    });

    it("un árbol que arranca de cero sale como proyecto-nuevo", () => {
      expect(fromScratch.intent.kind).toBe("proyecto-nuevo");
    });

    /**
     * Y éste es el fallo que el ADR 0003 existe para evitar: un árbol que habla
     * de algo YA DESPLEGADO clasificado como si hubiera que crearlo. No se
     * exige que acierte `fix` exactamente —eso es calidad del modelo y fijarlo
     * haría el test frágil—, se exige que no dé el proyecto por nuevo.
     */
    it("un arreglo sobre algo desplegado NO sale como proyecto-nuevo", () => {
      expect(onDeployed.intent.kind).not.toBe("proyecto-nuevo");
    });

    /** La única palanca del usuario para corregir la Intención (ADR 0003). */
    it("las Directrices del Usuario ganan a la deducción", () => {
      expect(guided.intent.kind).toBe("docs");
    });
  });

  /**
   * En español porque los árboles de muestra están en español, y el prompt dice
   * «escribe en el idioma del contenido del árbol, no en el de este prompt».
   * Se comprueba con palabras funcionales, que es lo único estable: los
   * sustantivos los elige el modelo.
   */
  it("responde en el idioma del árbol y no en el del prompt", () => {
    for (const analysis of [fromScratch, onDeployed, guided]) {
      expect(analysis.summary.toLowerCase()).toMatch(
        /\b(de|la|el|que|para|con|una|los)\b/,
      );
    }
  });

  /**
   * El renderer, sobre lo que de verdad escribió el modelo.
   *
   * Es la única forma de probar de verdad la promesa del ADR 0003: el renderer
   * no escribe adorno, pero el CONTENIDO lo escribe un modelo, y un modelo mete
   * `**` dentro de un título cuando le apetece. `render.test.ts` lo prueba con
   * adorno puesto a mano; esto lo prueba con adorno real, si viene.
   *
   * Comparte la lista negra con ese test (`testing/plain.ts`): dos copias
   * dejarían de ser la misma promesa, y la que se quedaría corta sería justo
   * la que mira la salida del modelo.
   */
  it("el Master Prompt sale sin adorno, aunque el modelo lo metiera", () => {
    for (const analysis of [fromScratch, onDeployed, guided]) {
      assertPlainText(renderMasterPrompt(analysis));
    }
  });
});

/**
 * Y la contract suite entera, con `AI_LIVE_CONTRACT=1`.
 *
 * Es la que `lib/ai/testing/contract.ts` dice que el adaptador tiene que pasar
 * para considerarse terminado. Vive detrás de una segunda llave y no del `npm
 * run ai:live` de siempre por las doce llamadas seguidas que hace: en el free
 * tier eso es un 429 probable, y un 429 aquí no dice nada del adaptador.
 *
 * Ojo con lo que puede fallar sin que nada esté roto: la suite afirma que todo
 * Nodo del árbol aparece LITERALMENTE en algún Ticket, y un modelo de verdad
 * parafrasea. Es la diferencia entre lo que se le puede pedir a un falso tonto
 * y a un modelo, y por eso este bloque es un diagnóstico y no una puerta.
 */
describe.skipIf(!CONTRACT)("y la contract suite entera contra Gemini", () => {
  describeAnalysisContract({
    name: "gemini (en vivo)",
    provider: () => createGeminiProvider(),
  });
});
