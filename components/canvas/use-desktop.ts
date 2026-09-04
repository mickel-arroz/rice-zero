"use client";

import { useMediaQuery } from "@/components/ui/use-media-query";

/**
 * Si el lienzo está en un escritorio, y por tanto se puede editar.
 *
 * ── Por qué esto existe, si el resto lo hace con CSS ──────────────────────
 *
 * «En móvil el Canvas es solo consulta» se cumple hasta ahora sin ninguna
 * bandera: el «+» de un Nodo y la barra de acciones se montan con `lg:` y
 * `hover`, así que en un teléfono no hay nada que tocar y no hay forma de
 * poner el interruptor al revés. Es el mejor mecanismo posible y se conserva.
 *
 * El ARRASTRE no cabe en ese mecanismo. `nodesDraggable` es una prop del
 * lienzo, no una clase, y un `@media` no puede quitarla: si estuviera puesta
 * en un teléfono, el primer dedo que rozara un Nodo lo despegaría del sitio en
 * vez de mover el lienzo — que es EL gesto de la vista en móvil. Así que aquí
 * la consulta tiene que llegar a JavaScript, y se hace en un solo sitio — con
 * las MISMAS dos condiciones que usa el CSS, no solo con el ancho.
 *
 * El cableado —suscribirse, medir, contestar `false` en el servidor— es el
 * mismo para cualquier consulta y vive en `useMediaQuery`. Aquí se queda lo
 * único propio: QUÉ se pregunta y por qué.
 */

/**
 * Las DOS condiciones del resto de la app, escritas para JavaScript.
 *
 * `64rem` es el `lg` de Tailwind —el único sitio del proyecto donde ese número
 * sale del CSS— y `hover: hover` es el `hover:` que acompaña a `lg:` en todos
 * los guardas de la vista. El ancho SOLO no basta y la diferencia no es
 * teórica: una tableta en horizontal pasa de 64rem, y con esto puesto el
 * primer dedo que rozara un Nodo lo despegaría en vez de mover el lienzo. Ahí
 * el gesto que hay que respetar es el desplazamiento, no el arrastre.
 *
 * Un portátil con pantalla táctil sí cumple las dos —su entrada principal es
 * el ratón—, y ahí el arrastre es correcto: eso es un escritorio con dedo, no
 * el «móvil» que el spec deja fuera.
 */
const DESKTOP_QUERY = "(min-width: 64rem) and (hover: hover)";

export function useDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
