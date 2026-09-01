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
 */

import type { AnalysisPromptInput } from "@/lib/ai/prompt";
import type { Analysis } from "@/lib/ai/schema";

export type AnalysisProvider = {
  /** Cómo se llama este adaptador. Solo para diagnóstico y para `ai_analyses`. */
  readonly name: string;
  /** El modelo concreto detrás. Se guarda con el Análisis: los modelos cambian. */
  readonly model: string;
  analyze(request: AnalysisPromptInput): Promise<Analysis>;
};
