/**
 * La capa de servicios de Análisis.
 *
 * Mismo contrato que `projects.ts`, `versions.ts` y `nodes.ts` (ADR 0001):
 * «cero llamadas al backend desde componentes o páginas». Una fábrica sobre un
 * `BackendProvider` para poder probarla, y un atajo sobre el activo.
 *
 * Lo que este servicio tiene de propio es que su trabajo está PARTIDO en dos
 * mitades que corren en sitios distintos:
 *
 *   · Generar corre en el SERVIDOR, porque la API key no puede salir de ahí.
 *     Eso es el Server Action, y llega aquí como una función inyectada.
 *   · Persistir corre en el NAVEGADOR, como todo lo demás de esta app: el ADR
 *     0001 decide que el cliente habla directo con PostgREST y que la
 *     autorización se queda en RLS. El Análisis se guarda por el mismo camino
 *     y con las mismas políticas que un Nodo.
 *
 * Este archivo es la costura entre las dos, y es el único sitio donde el orden
 * está escrito: primero se lee el árbol, luego se genera, y solo si eso salió
 * bien se escribe. Un componente que hiciera los tres pasos a mano podría
 * escribir antes de validar, y ahí se cae la promesa del ADR 0003 de que un
 * Análisis que no valida no se persiste nunca.
 *
 * La generación se INYECTA en vez de importarse, y no es por ceremonia: un
 * `import` del Server Action aquí pondría a `lib/` dependiendo de `app/`, que
 * es la dirección equivocada, y dejaría este archivo sin forma de probarse sin
 * un servidor de Next levantado.
 */

import type { AnalysisPromptInput } from "@/lib/ai/prompt";
import {
  analysisSchema,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  RemoteAnalysisError,
  type AnalysisContent,
  type AnalysisFailure,
} from "@/lib/ai";
import { getBackend } from "@/lib/backend";
import type {
  Analysis,
  BackendProvider,
  TreeNode,
} from "@/lib/backend/ports";
import { serializeTree } from "@/lib/tree/serialize";

/**
 * Lo que cabe en una petición de Análisis.
 *
 * Vive aquí y no en `AI_CONFIG` porque no es configuración de la LLAMADA —eso
 * son el modelo, el timeout y los reintentos— sino el tope de lo que se acepta
 * por la puerta. Mismo sitio y mismo criterio que `VERSION_LIMITS`: el límite
 * al lado del servicio que lo aplica y de los mensajes que lo explican.
 *
 * Existen porque el Server Action es un punto de entrada PÚBLICO: cualquiera
 * con sesión puede hacerle un POST, y lo que se gasta al atenderlo es el free
 * tier compartido. Next ya corta el cuerpo en 1 MB, pero eso es un tope de
 * transporte que llega como un fallo del framework y no como algo que se le
 * pueda explicar a nadie.
 */
export const ANALYSIS_INPUT_LIMITS = {
  /**
   * Cien mil caracteres son un árbol muy grande —del orden de quinientos Nodos
   * bien escritos— y siguen entrando de sobra en la ventana de un Flash.
   */
  treeMax: 100_000,
  /**
   * Las Directrices son instrucciones, no un documento: su bloque va con
   * PRIORIDAD ALTA delante del árbol, y unas Directrices más largas que el
   * propio árbol no corrigen la Intención — la sustituyen.
   */
  guidelinesMax: 10_000,
} as const;

/**
 * Los mensajes de los rechazos, todos en un sitio. Ver `VERSION_ERRORS`.
 *
 * Están JUNTOS aunque los lancen dos capas distintas —el servicio en el
 * navegador y el Server Action en el servidor— porque son la misma pregunta
 * contestada en dos sitios: «¿por qué no se puede analizar esto?». Repartidos,
 * el mismo rechazo acabaría dicho de dos maneras según por dónde entrase.
 */
export const ANALYSIS_ERRORS = {
  /**
   * Una Versión en la que nadie ha escrito nada todavía.
   *
   * El rechazo NO es un capricho de validación: sin él, pulsar «Generar» en
   * una Versión recién creada se lleva una petición del free tier para que el
   * modelo se invente un proyecto entero a partir de nada, y devuelva un
   * Análisis que no habla del árbol de nadie.
   */
  emptyVersion:
    "Esta Versión no tiene nada escrito todavía. Escribe alguna idea antes de generar un Análisis.",

  /**
   * Lo mismo, visto desde el servidor: no llegó árbol ninguno.
   *
   * Es otro mensaje y no el de arriba porque es otra situación: el de arriba lo
   * lee alguien que está mirando su Versión vacía, y éste solo aparece si algo
   * llamó al action sin pasar por la pantalla. Decirle «escribe alguna idea» a
   * quien mandó un POST vacío no ayudaría a nadie.
   */
  noTree: "No llegó ningún árbol que analizar.",

  treeTooBig: `El árbol es demasiado grande para analizarlo de una vez (más de ${ANALYSIS_INPUT_LIMITS.treeMax.toLocaleString("es")} caracteres). Prueba con una Versión más acotada.`,

  guidelinesNotText: "Las Directrices tienen que ser texto.",

  guidelinesTooLong: `Las Directrices no pueden pasar de ${ANALYSIS_INPUT_LIMITS.guidelinesMax.toLocaleString("es")} caracteres.`,

  /**
   * Lo que devolvió el servidor no es un Análisis.
   *
   * No debería pasar nunca: el adaptador lo validó antes de devolverlo. Pero
   * entre allí y aquí hay una serialización, y un tipo de TypeScript al otro
   * lado de una serialización es una promesa que nadie sostiene. Ver el
   * `.parse` de `generate`.
   */
  notAnAnalysis:
    "Lo que devolvió el servidor no es un Análisis válido, así que no se ha guardado.",
} as const;

/**
 * Lo que devuelve la mitad de servidor.
 *
 * Un resultado y no una promesa que lanza, y ésa es la decisión de forma que
 * manda en este archivo: lo que vuelve de un Server Action se serializa, y en
 * producción Next sustituye un `throw` del servidor por un mensaje genérico y
 * un digest. Una taxonomía de errores cuidadosamente normalizada que se lanza
 * al otro lado de esa frontera llega convertida en «An error occurred», así
 * que los fallos se DEVUELVEN. Quien los vuelve a convertir en excepción es
 * `generate`, aquí abajo.
 *
 * `provider` y `model` vienen del servidor porque es el único que sabe cuál
 * está activo: el interruptor `AI_PROVIDER` no es `NEXT_PUBLIC_`.
 */
export type GenerateAnalysisResult =
  | {
      ok: true;
      provider: string;
      model: string;
      /** Ya validado contra el schema: cruzó el `.parse` del adaptador. */
      content: AnalysisContent;
    }
  | { ok: false; failure: AnalysisFailure };

export type GenerateAnalysis = (
  request: AnalysisPromptInput,
) => Promise<GenerateAnalysisResult>;

export type AnalysisService = {
  /** Los Análisis de una Versión, del más nuevo al más viejo. */
  list(versionId: string): Promise<Analysis[]>;
  /**
   * Genera un Análisis de la Versión y lo guarda.
   *
   * @throws InvalidAnalysisInputError si la Versión no tiene nada escrito.
   *   No llega a llamar a la IA: es el fallo que se atrapa antes de gastar
   *   cuota.
   * @throws RemoteAnalysisError si la generación falló. `kind` dice por qué y
   *   `retryable` si tiene sentido volver a intentarlo.
   * @throws MalformedAnalysisError si lo que volvió del servidor no valida.
   *
   * Las tres son `AnalysisError`, así que un solo `catch` las cubre.
   */
  generate(input: {
    versionId: string;
    /** Directrices del Usuario. En blanco es no haber escrito ninguna. */
    guidelines?: string | null;
  }): Promise<Analysis>;
};

/**
 * ¿Hay algo que analizar aquí?
 *
 * Se pregunta por el CONTENIDO y no por el número de Nodos: pulsar «Primer
 * Nodo» deja una fila con el texto en blanco, que es el estado más normal de
 * una Versión recién empezada. `serializeTree` la pinta como `- (sin texto)`,
 * así que mirar si el texto serializado está vacío tampoco valdría.
 */
function hasSomethingToAnalyze(nodes: TreeNode[]): boolean {
  return nodes.some((node) => node.content.trim().length > 0);
}

export function createAnalysisService(
  backend: BackendProvider,
  generate: GenerateAnalysis,
): AnalysisService {
  return {
    list(versionId) {
      return backend.analyses.listByVersion(versionId);
    },

    async generate({ versionId, guidelines }) {
      // «En blanco» y «ausente» son lo mismo para una persona, así que aquí se
      // convierten en lo mismo antes de que las vean el prompt y el motor.
      // Mismo criterio que `normalizeLabel` en `versions.ts`.
      const userGuidelines = guidelines?.trim() || null;

      const nodes = await backend.nodes.listByVersion(versionId);
      if (!hasSomethingToAnalyze(nodes)) {
        throw new InvalidAnalysisInputError(ANALYSIS_ERRORS.emptyVersion);
      }

      const result = await generate({
        // El árbol se serializa AQUÍ y viaja como texto. Es lo que fija el
        // puerto de la IA: la serialización es del dominio del árbol, y un
        // adaptador que la repitiera a su manera daría Análisis distintos del
        // mismo árbol.
        serializedTree: serializeTree(nodes),
        guidelines: userGuidelines,
      });

      if (!result.ok) throw new RemoteAnalysisError(result.failure);

      /**
       * Y se valida OTRA VEZ, justo antes de escribir.
       *
       * El adaptador ya lo hizo, y aun así ésta es la comprobación que sostiene
       * la promesa del ADR 0003 —«un Análisis que no valida no se persiste
       * nunca»— en el sitio donde se persiste. Entre el `.parse` del adaptador y
       * esta línea hay una frontera de serialización: `result.content` está
       * tipado, pero un tipo al otro lado de una serialización es una promesa
       * del compilador que el compilador no puede sostener. Sin esto, la
       * invariante dependía de que nadie tocara el camino de vuelta.
       *
       * Sale como `malformada`, la misma categoría que usaría el adaptador: es
       * el mismo fallo visto un paso después.
       */
      const parsed = analysisSchema.safeParse(result.content);
      if (!parsed.success) {
        throw new MalformedAnalysisError(
          parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
          { cause: parsed.error },
        );
      }

      return backend.analyses.create({
        versionId,
        userGuidelines,
        provider: result.provider,
        model: result.model,
        content: parsed.data,
      });
    },
  };
}

/**
 * El servicio sobre el Proveedor de Backend activo. Sin memoizar.
 *
 * La generación sigue siendo un parámetro: quien monta el panel le pasa el
 * Server Action importado. Un `import` de él aquí dentro pondría a `lib/`
 * dependiendo de `app/`.
 */
export function analysisService(generate: GenerateAnalysis): AnalysisService {
  return createAnalysisService(getBackend(), generate);
}
