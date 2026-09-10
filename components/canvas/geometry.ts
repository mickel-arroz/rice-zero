/**
 * Cuánto ocupa un Nodo dibujado en el lienzo, y por dónde se mira el bosque.
 *
 * Vive aquí y no en `lib/tree` porque no es geometría del ÁRBOL sino de cómo
 * lo dibuja esta vista: sus rellenos, su tipografía y cuántas líneas enseña
 * antes de recortar. `layoutForest` no sabe nada de esto — le llega ya medido.
 *
 * ── Ancho fijo, alto variable ─────────────────────────────────────────────
 *
 * El ancho NO cambia y el alto sí. El layout automático necesita una dimensión
 * estable para repartir el espacio, y además un árbol de cajas de anchos
 * dispares se lee como un collage: la columna deja de existir. Creciendo hacia
 * abajo, en cambio, el diagrama sigue siendo legible con textos largos, que es
 * lo que #48 pide.
 *
 * ── Por qué se estima en vez de medirse ───────────────────────────────────
 *
 * Colocar el árbol necesita saber lo que mide cada Nodo ANTES de pintarlo, y
 * medir de verdad querría decir pintar, medir y volver a colocar: dos pasadas
 * y un parpadeo en cada tecla. Aquí se estima con el número de caracteres
 * —Iosevka es de ancho fijo, así que la cuenta es honesta— y el Nodo se pinta
 * con EXACTAMENTE el alto estimado.
 *
 * Eso convierte a `charsPerLine` en lo único que sostiene el dibujo, y por eso
 * va por DEBAJO de lo que de verdad cabe —caben unos 27—: el texto rompe por
 * PALABRAS, así que una palabra que no entra se lleva la línea entera.
 * Quedarse corto sobra un poco de aire al final de la caja; pasarse dejaría al
 * Nodo desbordando por abajo sobre su hermano. Antes había una red de
 * seguridad —el recorte con puntos suspensivos a `maxLines`— y era justamente
 * lo que #48 quita: leer un Nodo en el Canvas ya no exige abrirlo. La cuenta
 * tiene ahora que ser conservadora por sí sola.
 */

import type { NodeSize } from "@/lib/tree/layout";

/**
 * Un ancho y un alto, sin dueño.
 *
 * Existe porque `fitViewport` compara DOS cosas que no son Nodos —lo que ocupa
 * el bosque y lo que mide el lienzo—, y prestarles `NodeSize` decía que lo
 * eran.
 */
export type Size = {
  width: number;
  height: number;
};

export const CANVAS_NODE = {
  /** Ancho fijo. Un árbol de cajas dispares se lee como un collage. */
  width: 208,
  /** El alto de línea del texto, en píxeles (13 px × 1,55). */
  lineHeight: 20,
  /** Lo que suman los rellenos de arriba y abajo. */
  padding: 22,
  charsPerLine: 24,
} as const;

/**
 * Cuántas líneas ocupa un texto. Todas las que haga falta: no hay tope.
 *
 * Lo hubo —tres, y a partir de ahí puntos suspensivos— y era lo que obligaba a
 * abrir un Nodo para saber qué decía. Sin tope, el Nodo crece hacia abajo y el
 * texto se lee entero desde el diagrama.
 *
 * Un Nodo sin texto ocupa una: enseña el marcador «Escribe tu idea…», que
 * también hay que poder leer.
 */
export function nodeLines(text: string): number {
  const content = text.trim();
  if (content.length === 0) return 1;

  // Los saltos de línea cuentan: el campo del Registro es un `textarea` y una
  // idea escrita en tres renglones ocupa tres.
  return content
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / CANVAS_NODE.charsPerLine)),
      0,
    );
}

/** Lo que mide un Nodo con ese texto. */
export function nodeSize(text: string): NodeSize {
  return {
    width: CANVAS_NODE.width,
    height: CANVAS_NODE.padding + nodeLines(text) * CANVAS_NODE.lineHeight,
  };
}

/** El aire entre el bosque y el borde del lienzo, en píxeles de pantalla. */
export const CANVAS_PADDING = 24;

/**
 * Los cuatro límites del zoom, juntos.
 *
 * Juntos a propósito: son dos parejas que solo se entienden una al lado de la
 * otra. `fitMin`/`fitMax` acotan lo que hace el ENCAJE; `min`/`max`, hasta
 * dónde puede llegar la PERSONA a mano. Y `min` es bastante menor que `fitMin`
 * porque alejar del todo es cómo se mira la forma de un árbol grande — eso sí
 * se pide — mientras que un encaje que no se lee no es un encaje.
 *
 * `fitMin` es el número interesante: sin él, un bosque alto —una raíz con
 * quince subnodos ya lo es— cabía entero a 0,4 y no había quien lo leyera. Por
 * debajo de aquí se prefiere recortar y dejar que el dedo se mueva.
 */
export const CANVAS_ZOOM = {
  min: 0.2,
  max: 2,
  fitMin: 0.55,
  /** Acercarse más de 1:1 haría letras gigantes en un árbol de dos Nodos. */
  fitMax: 1,
} as const;

/** Dónde y con cuánto zoom mira el lienzo al bosque. */
export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

/**
 * La vista con la que se abre el Canvas: el bosque encajado, o su principio.
 *
 * Es una función pura y no una llamada a `fitView` porque el encaje del lienzo
 * hace dos cosas que aquí no valen. La primera es que CENTRA siempre: con un
 * bosque más alto que la pantalla, abrir centrado dejaba la primera raíz fuera
 * y arrancabas leyendo por la mitad de la tercera, sin nada que dijera que
 * había dos por encima. Un árbol se lee desde su primera idea. La segunda es
 * que necesita que el lienzo haya MEDIDO los Nodos, y encajar antes de eso
 * —que es lo que pasa al abrir— es encajar cajas de tamaño cero.
 *
 * Nada de eso hace falta: `layoutForest` ya devolvió lo que ocupa el bosque
 * exacto. Con eso y el tamaño del lienzo, la cuenta se hace aquí y se prueba
 * sin navegador.
 *
 * Cabe → centrado. No cabe → pegado a esa esquina, con su aire.
 */
export function fitViewport(content: Size, pane: Size): CanvasViewport {
  const usableWidth = pane.width - CANVAS_PADDING * 2;
  const usableHeight = pane.height - CANVAS_PADDING * 2;

  // Un bosque o un lienzo sin tamaño: no hay nada que encajar todavía.
  if (
    content.width <= 0 ||
    content.height <= 0 ||
    usableWidth <= 0 ||
    usableHeight <= 0
  ) {
    return { x: CANVAS_PADDING, y: CANVAS_PADDING, zoom: 1 };
  }

  const zoom = Math.min(
    CANVAS_ZOOM.fitMax,
    Math.max(
      CANVAS_ZOOM.fitMin,
      Math.min(usableWidth / content.width, usableHeight / content.height),
    ),
  );

  /** Centra si sobra sitio; si no, pega al borde y deja que se desplace. */
  const place = (size: number, available: number) =>
    size <= available
      ? (available - size) / 2 + CANVAS_PADDING
      : CANVAS_PADDING;

  return {
    x: place(content.width * zoom, usableWidth),
    y: place(content.height * zoom, usableHeight),
    zoom,
  };
}

/**
 * Una caja ya colocada por el layout, en coordenadas del bosque.
 *
 * Es la forma que devuelve `layoutForest` en `boxes`, recortada a lo que hace
 * falta para apuntar la cámara. Se declara aquí y no se importa de `layout.ts`
 * para que esta función siga sin saber qué es un Nodo: lo que centra es una
 * caja, y de dónde salió es problema de quien llama.
 */
export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Dónde mirar para que una caja se vea, o `null` si ya se está viendo.
 *
 * Existe por la Búsqueda en el Canvas: pulsar un resultado seleccionaba el Nodo
 * y le ponía el foco, pero si estaba fuera de la pantalla no pasaba nada
 * visible — la cámara se quedaba donde estaba y el usuario se quedaba mirando
 * un lienzo que, hasta donde él veía, no había hecho nada.
 *
 * ── Por qué devuelve `null` en vez de centrar siempre ─────────────────────
 *
 * Porque centrar una caja que ya se está viendo es un salto gratuito. Todo lo
 * que selecciona un Nodo pasa por aquí —la Búsqueda, pero también pulsar el
 * propio Nodo en el lienzo—, y recolocar la cámara cada vez que alguien toca
 * algo mueve el árbol bajo el dedo justo al señalarlo. Si se ve, no se toca.
 *
 * ── Y por qué conserva el zoom ────────────────────────────────────────────
 *
 * Se mueve la cámara, no se cambia el objetivo. El zoom es del usuario: lo puso
 * él con los botones o con la rueda, y buscar un Nodo no es motivo para
 * deshacerlo. `fitViewport` sí lo calcula, pero eso es abrir el Canvas, que es
 * otra cosa.
 *
 * @param box la caja a la que apuntar, en coordenadas del bosque.
 * @param pane lo que mide el lienzo en pantalla.
 * @param current dónde mira la cámara ahora.
 * @returns la vista nueva, o `null` si no hay que moverse.
 */
export function revealViewport(
  box: Box,
  pane: Size,
  current: CanvasViewport,
): CanvasViewport | null {
  const { zoom } = current;

  // Sin lienzo medido no hay «dentro» ni «fuera» que decidir. Pasa en el primer
  // render, cuando la caja del lienzo todavía es de cero.
  if (pane.width <= 0 || pane.height <= 0) return null;

  // La caja en coordenadas de PANTALLA, que es donde se mira si cabe.
  const left = box.x * zoom + current.x;
  const top = box.y * zoom + current.y;
  const right = left + box.width * zoom;
  const bottom = top + box.height * zoom;

  // Con su aire: una caja pegada al borde exacto está técnicamente dentro y se
  // lee como cortada. El mismo margen que usa el encaje, para que «visible»
  // signifique lo mismo en los dos sitios.
  const visible =
    left >= CANVAS_PADDING &&
    top >= CANVAS_PADDING &&
    right <= pane.width - CANVAS_PADDING &&
    bottom <= pane.height - CANVAS_PADDING;

  if (visible) return null;

  // Centrada. No «lo mínimo para que entre»: quien acaba de buscar un Nodo está
  // buscando ESE, y dejarlo rozando el borde inferior obliga a buscarlo otra
  // vez con los ojos.
  return {
    x: pane.width / 2 - (box.x + box.width / 2) * zoom,
    y: pane.height / 2 - (box.y + box.height / 2) * zoom,
    zoom,
  };
}
