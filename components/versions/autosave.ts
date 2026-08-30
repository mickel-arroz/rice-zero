/**
 * La política del Autoguardado al renombrar una Versión.
 *
 * Existe por lo mismo que `components/tree/autosave.ts` y
 * `components/projects/autosave.ts`: la única parte de la edición que tiene
 * una DECISIÓN dentro se saca a una función pura, para poder comprobarla sin
 * montar un componente. Todo lo demás —el `setTimeout` del rebote, el estado
 * del pie— es cableado de React.
 *
 * Y existe APARTE de las otras dos, en vez de reusarlas, porque la regla es
 * una tercera y esa diferencia es el contenido de este archivo: la etiqueta de
 * una Versión SÍ puede quedar vacía —quedarse sin etiqueta es volver a
 * llamarse por su número— y lo guardado puede ser `null`, que es un estado que
 * ni un título de Proyecto ni el texto de un Nodo tienen.
 */

/**
 * Cuánto se espera desde la última tecla antes de escribir.
 *
 * El mismo medio segundo que el texto de un Nodo, y a propósito: son el mismo
 * gesto para quien escribe, y dos ritmos distintos en la misma pantalla se
 * notarían sin que nadie supiera por qué.
 */
export const VERSION_LABEL_DEBOUNCE_MS = 500;

export type LabelSavePlan =
  /** No hay nada que escribir. */
  | { kind: "idle" }
  /** Hay que persistir esta etiqueta, tal cual se tecleó. */
  | { kind: "save"; label: string };

/**
 * ¿Hay que guardar lo que hay en el campo de la etiqueta?
 *
 * @param draft lo que hay ahora mismo en el campo, en crudo.
 * @param saved la etiqueta que el motor confirmó — ya normalizada por la capa
 *   de servicios, así que o viene recortada o es `null`. Es el punto de
 *   comparación, y no la etiqueta con la que se abrió el campo, para que
 *   volver a lo que ya se guardó no dispare otra escritura.
 */
export function planLabelSave(draft: string, saved: string | null): LabelSavePlan {
  // Se COMPARA normalizado y se MANDA en crudo, igual que `planAutosave`.
  //
  // Normalizado, porque es la forma que va a acabar teniendo la fila:
  // `versionService().rename` recorta y convierte lo que quede vacío en `null`,
  // así que «Rumbo B  » y «Rumbo B» son la misma etiqueta y mandarla sería una
  // escritura que no cambia nada. Y `null` y `""` son el mismo estado —«sin
  // etiqueta»—, que es lo que permite que el campo de una Versión sin etiqueta
  // se abra vacío sin que abrirlo escriba: si no se igualaran aquí, cada
  // despliegue del menú escribiría un `null` encima de otro `null` y el pie
  // diría «Guardando…» sin que nadie haya tecleado.
  //
  // En crudo, porque normalizar aquí sería tener la regla en dos sitios, y la
  // del servicio es la que manda.
  if (draft.trim() === (saved ?? "")) return { kind: "idle" };

  // Vaciar el campo cae aquí, y es lo correcto: es la única forma que hay de
  // quitarle la etiqueta a una Versión y devolverla a llamarse por su número.
  return { kind: "save", label: draft };
}
