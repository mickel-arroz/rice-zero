/**
 * El Proveedor de IA: qué se le pide y qué devuelve, sin decir con qué.
 *
 * Es lo único que la app conoce del modelo. Gemini es el primero (#15), pero
 * el proyecto es indiferente a cuál se usa (`CONTEXT.md` → Proveedor de IA), y
 * eso solo es cierto mientras nadie importe un SDK fuera de su adaptador.
 *
 * Entra el árbol YA serializado y no la lista de Nodos: la serialización es
 * una decisión del dominio del árbol (`lib/tree/serialize.ts`) y un adaptador
 * que la repitiera a su manera daría Análisis distintos del mismo árbol.
 *
 * Sale un `Analysis` ya validado contra el schema. Validar es trabajo del
 * adaptador y no de quien llama: una respuesta malformada no debe cruzar esta
 * frontera ni llegar nunca a persistirse.
 *
 * Y sale además QUÉ modelo lo escribió. Eso no es diagnóstico opcional: un
 * adaptador puede tener varios modelos y caer de uno a otro, así que cuál
 * contestó es un dato de la respuesta y no una propiedad del proveedor. Ver
 * `AnalysisOutcome`.
 */

import type { AnalysisPromptInput } from "@/lib/ai/prompt";
import type { Analysis } from "@/lib/ai/schema";

/**
 * Un Análisis y el modelo que lo escribió.
 *
 * Los dos juntos y no el Análisis a secas porque `ai_analyses.model` existe
 * para saber CUÁL lo produjo, y con una lista de modelos de reserva eso deja de
 * ser algo que el proveedor pueda declarar de antemano.
 *
 * El campo estaba antes en el proveedor (`provider.model`) y era correcto
 * mientras hubo un modelo y uno solo. Con una cadena de reserva, un
 * `provider.model` fijo habría guardado el modelo PREFERIDO en vez del que
 * contestó: la provenance de todo Análisis servido por un plan B habría sido
 * falsa, sin que nada fallara.
 */
export type AnalysisOutcome = {
  analysis: Analysis;
  /** El modelo que de verdad respondió. Se guarda con el Análisis. */
  model: string;
};

export type AnalysisProvider = {
  /** Cómo se llama este adaptador. Solo para diagnóstico y para `ai_analyses`. */
  readonly name: string;
  /**
   * Los modelos que puede usar, en orden de preferencia.
   *
   * En plural porque un adaptador puede tener reserva, y `readonly` porque es
   * su configuración y no algo que quien llama pueda tocar. Sirve para
   * diagnóstico y para que la contract suite pueda afirmar que el proveedor se
   * identifica; cuál se usó de verdad lo dice `AnalysisOutcome`.
   *
   * Nunca vacía: un proveedor sin ningún modelo no puede cumplir el contrato.
   */
  readonly models: readonly string[];
  analyze(request: AnalysisPromptInput): Promise<AnalysisOutcome>;
};
