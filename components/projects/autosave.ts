/**
 * La política del Autoguardado al editar un Proyecto.
 *
 * Está aparte del diálogo, y es una función PURA, porque es la única parte de
 * la edición que tiene decisiones dentro: cuándo se escribe, qué se manda y qué
 * se hace con un borrador que todavía no vale. Todo lo demás —el `setTimeout`
 * del rebote, el estado del pie, el foco— es cableado de React, y mezclarlo con
 * esto dejaría la decisión sin poder probarse sin montar un componente.
 *
 * «Todo cambio mínimo se persiste de inmediato; no existe botón guardar»
 * (CONTEXT.md). Lo que este módulo decide es qué significa exactamente «cambio»
 * y qué pasa cuando lo escrito aún no se puede guardar.
 */

import type { ProjectIconKey } from "@/components/icons/projects";
import { PROJECT_ERRORS, type ProjectPatchInput } from "@/lib/services/projects";

/**
 * Lo que hay en el formulario, o lo último que el motor confirmó.
 *
 * `description` es `string` y no `string | null` porque es lo que un `<input>`
 * tiene: un campo vacío es `""`. Traducir ese vacío a nulo es cosa de la capa
 * de servicios, y hacerlo aquí también sería tener la regla en dos sitios.
 */
export type ProjectDraft = {
  title: string;
  description: string;
  /**
   * Una clave del catálogo, no un texto cualquiera.
   *
   * Es lo contrario que en `Project.icon`, y a propósito: allí llega de una fila
   * que pudo escribir cualquiera, aquí sale del selector, que solo ofrece las
   * treinta. El diálogo hace la conversión UNA vez, al abrir, y a partir de ahí
   * nadie más tiene que dudar ni castear.
   */
  icon: ProjectIconKey;
};

export type AutosavePlan =
  /** No hay nada que escribir. */
  | { kind: "idle" }
  /** Hay que persistir esto, y solo esto. */
  | { kind: "save"; patch: ProjectPatchInput }
  /** El borrador todavía no vale. No se escribe, y se le dice al usuario. */
  | { kind: "invalid"; message: string };

/**
 * ¿Hay que guardar este borrador, y qué exactamente?
 *
 * @param draft lo que hay ahora mismo en el formulario.
 * @param saved lo último que el motor confirmó. Es el punto de comparación, y
 *   no el Proyecto original, para que una segunda pulsación sobre un campo que
 *   ya se guardó no vuelva a escribirlo.
 */
export function planAutosave(draft: ProjectDraft, saved: ProjectDraft): AutosavePlan {
  // El título frena el parche ENTERO y no solo su propia clave: guardar el
  // icono mientras el título está a medias de reescribirse dejaría el pie
  // diciendo «Guardado» con la mitad sin guardar.
  if (draft.title.trim().length === 0) {
    return { kind: "invalid", message: PROJECT_ERRORS.titleEmpty };
  }

  // Se COMPARA recortado y se MANDA en crudo. Comparar recortado porque la capa
  // de servicios recorta antes de escribir, así que «Tienda » y «Tienda» acaban
  // siendo la misma fila y mandarlo sería una escritura que no cambia nada.
  // Mandar en crudo porque normalizar aquí sería tener la regla en dos sitios,
  // y la del servicio es la que manda.
  const patch: ProjectPatchInput = {};
  if (draft.title.trim() !== saved.title.trim()) patch.title = draft.title;
  if (draft.description.trim() !== saved.description.trim()) {
    // Vaciarla cuenta como cambio: si no, no habría forma de quitar una
    // descripción, porque «vacía» y «sin tocar» serían lo mismo.
    patch.description = draft.description;
  }
  if (draft.icon !== saved.icon) patch.icon = draft.icon;

  // Una clave sin cambio no viaja: el puerto distingue `undefined` («no lo
  // toques») de `null` («ponlo a nulo»), y mandarlo todo perdería la
  // diferencia.
  return Object.keys(patch).length === 0 ? { kind: "idle" } : { kind: "save", patch };
}
