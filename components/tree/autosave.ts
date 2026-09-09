/**
 * La política del Autoguardado del texto de un Nodo.
 *
 * Existe por lo mismo que `components/projects/autosave.ts`: la única parte de
 * la edición que tiene una DECISIÓN dentro se saca a una función pura, para
 * poder comprobarla sin montar un componente. Todo lo demás —el `setTimeout`
 * del rebote, el foco, el estado del pie— es cableado de React.
 *
 * Y existe APARTE de aquélla, en vez de reusarla, porque las dos reglas son
 * distintas y esa diferencia es el contenido de este archivo: el título de un
 * Proyecto se recorta y no puede quedar vacío; el texto de un Nodo no se toca
 * y sí puede. Compartir una función habría obligado a un parámetro «¿recorto?»,
 * que es la forma de esconder dos decisiones dentro de una.
 */

/**
 * Cuánto se espera desde la última tecla antes de escribir.
 *
 * Corto a propósito: «todo cambio mínimo se persiste de inmediato»
 * (`CONTEXT.md`), y el rebote solo está para no mandar una escritura por
 * pulsación. Medio segundo es lo que tarda una persona en dudar entre dos
 * palabras, así que la ráfaga se agrupa sin que la pantalla parezca lenta.
 *
 * Las operaciones de ESTRUCTURA no pasan por aquí: crear, mover y borrar se
 * escriben en el acto. Solo rebota el tecleo.
 */
export const NODE_TEXT_DEBOUNCE_MS = 500;

export type NodeSavePlan =
  /** No hay nada que escribir. */
  | { kind: "idle" }
  /** Hay que persistir este texto, tal cual. */
  | { kind: "save"; content: string };

/**
 * ¿Hay que guardar lo que hay en el campo?
 *
 * @param draft lo que hay ahora mismo en el campo.
 * @param saved lo último que el motor confirmó. Es el punto de comparación, y
 *   no el texto con el que se abrió, para que volver a lo que ya se guardó no
 *   dispare otra escritura.
 *
 * Se compara EN CRUDO —sin `trim`, al revés que `planAutosave`—, y esa es toda
 * la regla: el servicio guarda el texto tal cual se teclea, así que cualquier
 * diferencia visible en el campo es una diferencia que hay que persistir. Un
 * `trim` aquí perdería el espacio que el usuario acaba de escribir entre dos
 * palabras, y el siguiente carácter lo volvería a mandar de todas formas.
 */
export function planNodeSave(draft: string, saved: string): NodeSavePlan {
  return draft === saved ? { kind: "idle" } : { kind: "save", content: draft };
}

/**
 * Qué hacer con un Nodo cuando se cierra su campo.
 *
 * `keep` es lo normal: guardar lo tecleado y dejarlo donde está.
 * `discard` borra el Nodo entero. Solo cabe cuando no queda nada que guardar.
 */
export type NodeBlurPlan = { kind: "keep" } | { kind: "discard" };

/**
 * ¿Sobrevive este Nodo al desenfoque?
 *
 * La regla es «un Nodo VACÍO no sobrevive al desenfoque», no «no se puede crear
 * vacío»: los Nodos nacen vacíos por diseño —crear y escribir son dos gestos, y
 * el segundo ocurre dentro— así que la limpieza tiene que ocurrir al salir y no
 * al entrar.
 *
 * Y solo si no tiene hijos, que es la mitad importante y no un matiz: borrar un
 * Nodo se lleva su subárbol por delante (`on delete cascade`), así que sin esta
 * condición vaciar un título destruiría trabajo en silencio y sin el diálogo de
 * confirmación que cualquier otro borrado exige.
 *
 * Vacío es sin texto VISIBLE: se compara con `trim`, al revés que `planNodeSave`
 * —que guarda en crudo—, y las dos cosas son coherentes. Aquélla contesta «¿esto
 * es un cambio?», donde un espacio lo es; ésta contesta «¿hay una idea aquí?»,
 * donde un espacio no la hay. Un Nodo con una barra espaciadora dentro es un
 * hueco en el árbol igual que uno sin nada.
 *
 * @param content lo que hay en el campo: el borrador si lo hay, si no lo guardado.
 * @param hasChildren si algún Nodo cuelga de éste.
 */
export function planNodeBlur(
  content: string,
  hasChildren: boolean,
): NodeBlurPlan {
  if (hasChildren) return { kind: "keep" };
  return content.trim().length === 0 ? { kind: "discard" } : { kind: "keep" };
}
