"use server";

/**
 * La generación de un Análisis, en el servidor.
 *
 * Aquí está SOLO la mitad que no puede correr en otro sitio: la llamada al
 * modelo, porque la API key no sale del servidor. Persistir NO está aquí, y es
 * deliberado — el ADR 0001 pone el acceso a datos en el navegador, hablando
 * directo con PostgREST bajo RLS, y un Análisis se guarda por el mismo camino y
 * con las mismas políticas que un Nodo. Quien cose las dos mitades es
 * `lib/services/analyses.ts`.
 *
 * Un Server Action es un punto de entrada PÚBLICO: se compila a un POST contra
 * la ruta que lo invoca, y alcanzarlo no exige pasar por la interfaz (docs de
 * Next, `server-actions.md`: «trátalo como no confiable»). Lo que hay en juego
 * aquí no son los datos de nadie —ni se lee ni se escribe nada— sino el free
 * tier compartido, así que las dos comprobaciones de abajo son las que impiden
 * que un desconocido nos gaste la cuota.
 *
 * Y devuelve sus fallos en vez de lanzarlos. En producción Next sustituye un
 * error del servidor por un mensaje genérico y un digest, así que una taxonomía
 * lanzada desde aquí llegaría al panel como «An error occurred» — con lo que
 * todo el trabajo de normalizar los errores no habría servido de nada.
 */

import { getAnalysisProvider } from "@/lib/ai/factory";
import {
  describeAnalysisFailure,
  InvalidAnalysisInputError,
  SessionRequiredError,
  type AnalysisPromptInput,
} from "@/lib/ai";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import {
  ANALYSIS_ERRORS,
  ANALYSIS_INPUT_LIMITS,
  type GenerateAnalysisResult,
} from "@/lib/services/analyses";

/**
 * Exige que lo que llegó por el cable se pueda analizar.
 *
 * El tipo de TypeScript no vale de nada aquí: lo que entra es lo que venga en
 * el POST, y `AnalysisPromptInput` es una promesa del compilador que el
 * compilador no puede sostener del otro lado de la red.
 *
 * Los mensajes y los topes salen de `lib/services/analyses.ts`, con los demás
 * rechazos de Análisis. Escribirlos aquí dejaría la misma pregunta —«¿por qué
 * no se puede analizar esto?»— contestada en dos sitios y de dos maneras.
 */
function requireAnalyzableRequest(request: AnalysisPromptInput): void {
  const { serializedTree, guidelines } = request ?? {};

  if (typeof serializedTree !== "string" || serializedTree.trim().length === 0) {
    throw new InvalidAnalysisInputError(ANALYSIS_ERRORS.noTree);
  }
  if (serializedTree.length > ANALYSIS_INPUT_LIMITS.treeMax) {
    throw new InvalidAnalysisInputError(ANALYSIS_ERRORS.treeTooBig);
  }
  if (guidelines != null && typeof guidelines !== "string") {
    throw new InvalidAnalysisInputError(ANALYSIS_ERRORS.guidelinesNotText);
  }
  if ((guidelines?.length ?? 0) > ANALYSIS_INPUT_LIMITS.guidelinesMax) {
    throw new InvalidAnalysisInputError(ANALYSIS_ERRORS.guidelinesTooLong);
  }
}

/**
 * Genera un Análisis del árbol que se le pase. No persiste nada.
 *
 * Recibe el árbol YA serializado en vez de un `versionId`, y eso merece una
 * palabra porque va contra el consejo por defecto de los docs de Next («manda
 * una referencia y vuelve a leer el resto de una fuente de confianza»). Ese
 * consejo protege de que alguien opere sobre una FILA que no es suya, y aquí no
 * se opera sobre ninguna: el árbol es contenido que el llamante aporta, no se
 * lee nada del motor, y lo que se genera vuelve al llamante sin guardarse. La
 * escritura la hace después el navegador con su propio token, así que RLS sigue
 * siendo lo único que decide en qué Versión se puede guardar. Pedir el
 * `versionId` y leer el árbol aquí exigiría un camino de datos en servidor que
 * el ADR 0001 no tiene — y no protegería nada más.
 */
export async function generateAnalysis(
  request: AnalysisPromptInput,
): Promise<GenerateAnalysisResult> {
  try {
    // Primero la sesión, antes de mirar siquiera lo que mandó: quien no ha
    // entrado no llega ni a que le validemos el árbol. `canAct` y no «hay
    // sesión» porque el spec exige email confirmado para actuar.
    if (!canAct(await requestSession())) throw new SessionRequiredError();

    requireAnalyzableRequest(request);

    const provider = getAnalysisProvider();
    const content = await provider.analyze({
      serializedTree: request.serializedTree,
      guidelines: request.guidelines ?? null,
    });

    return {
      ok: true,
      provider: provider.name,
      model: provider.model,
      content,
    };
  } catch (error) {
    // Un solo `catch` para todo, y sin `console.error` de la respuesta: el
    // texto que devolvió el modelo es el árbol de una persona masticado, y no
    // tiene por qué acabar en el log de la plataforma. Lo que se pierda de
    // diagnóstico lo compensan `kind` e `issues`, que sí viajan.
    return { ok: false, failure: describeAnalysisFailure(error) };
  }
}
