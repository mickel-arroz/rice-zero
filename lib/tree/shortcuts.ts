/**
 * Cómo se ESCRIBE cada atajo del árbol, para poder enseñarlo.
 *
 * El mapa (`lib/tree/keymap.ts`) decide qué hace cada pulsación; esto solo dice
 * cómo se teclea, y existe porque un atajo que nadie sabe que está no sirve de
 * nada. La barra de acciones lo pone en el `title` y en el nombre accesible de
 * cada botón, que es donde se busca cuando uno se pregunta «¿esto tendrá
 * atajo?».
 *
 * Va en un módulo aparte y no dentro del mapa porque son dos cosas con dos
 * vidas: el mapa es la decisión —y no puede depender de cómo se pinte— y esto
 * es copia, que además cambia con el sistema. Pero SALEN DE LA MISMA LISTA de
 * acciones (`TreeKeyAction`), así que el día que el mapa gane una, TypeScript
 * obliga a escribirle su forma aquí antes de compilar.
 *
 * ── Por qué dice «Ctrl» y no «Cmd» en un Mac ──────────────────────────────
 *
 * Dice los dos, y en ese orden. El mapa acepta las dos teclas en cualquier
 * sistema a propósito —detectar la plataforma es mirar un `userAgent` que
 * miente—, así que la etiqueta no puede prometer una sola. `Ctrl/Cmd` es más
 * largo de leer y es lo único que es verdad en las dos máquinas.
 */

import type { TreeKeyAction } from "@/lib/tree/keymap";

/**
 * El modificador, escrito. Una constante y no el texto suelto en ocho sitios:
 * es el mismo prefijo en todos, y ocho copias se desincronizan en cuanto
 * alguien decida escribirlo de otra manera.
 */
const MOD = "Ctrl/Cmd";

/**
 * Cómo se teclea cada acción.
 *
 * `Record<TreeKeyAction, string>` y no un objeto suelto: es lo que hace que una
 * acción nueva en el mapa no compile hasta que se le escriba aquí su forma.
 *
 * Las flechas van con su símbolo y no con su nombre: «↑» se lee de un vistazo
 * dentro de una pastilla de dos palabras, y «Flecha arriba» no.
 */
export const SHORTCUTS: Record<TreeKeyAction, string> = {
  createSibling: `${MOD} + Enter`,
  createChild: `${MOD} + Shift + Enter`,
  focusPrev: `${MOD} + ↑`,
  focusNext: `${MOD} + ↓`,
  moveUp: `${MOD} + Shift + ↑`,
  moveDown: `${MOD} + Shift + ↓`,
  collapse: `${MOD} + ←`,
  expand: `${MOD} + →`,
  reparent: `${MOD} + Shift + ←`,
  toggleCompleted: `${MOD} + Shift + Espacio`,
  remove: `${MOD} + Retroceso`,
};

/**
 * `Escape`, que no está en el mapa y sí tiene que poder enseñarse.
 *
 * Es la octava acción de la barra —«Quitar»— y la única sin modificador. El
 * porqué está en la cabecera de `keymap.ts`: no es un atajo del árbol, es el
 * «cancelar» de toda la app.
 */
export const DESELECT_SHORTCUT = "Escape";

/**
 * La etiqueta de un botón con su atajo detrás, para `title` y `aria-label`.
 *
 * Los dos, y ahí está el motivo de que esto sea una función y no un texto
 * pegado en el `title`: el `title` solo lo ve quien tiene ratón y espera un
 * segundo encima. Desde que la barra es solo iconos (#39), el nombre accesible
 * es lo ÚNICO que un lector de pantalla anuncia, y dejar el atajo fuera de él
 * dejaría el teclado escondido justo para quien más lo usa.
 */
export function withShortcut(label: string, shortcut: string): string {
  return `${label} · ${shortcut}`;
}
