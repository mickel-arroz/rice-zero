/**
 * Cuánto ocupa un Nodo dibujado en el lienzo, y por dónde se mira el bosque.
 *
 * Vive aquí y no en `lib/tree` porque no es geometría del ÁRBOL sino de cómo
 * lo dibuja esta vista: sus rellenos, su tipografía y cuántas líneas enseña
 * antes de recortar. `layoutForest` no sabe nada de esto — le llega ya medido.
 *
 * ── Por qué se estima en vez de medirse ───────────────────────────────────
 *
 * Colocar el árbol necesita saber lo que mide cada Nodo ANTES de pintarlo, y
 * medir de verdad querría decir pintar, medir y volver a colocar: dos pasadas
 * y un parpadeo en cada tecla. Aquí se estima con el número de caracteres
 * —Iosevka es de ancho fijo, así que la cuenta es honesta— y el Nodo se pinta
 * con EXACTAMENTE el alto estimado, recortando con puntos suspensivos si el
 * texto se pasa. Así la estimación no puede quedarse corta: es el dibujo el
 * que obedece a la cuenta, y no al revés.
 *
 * `charsPerLine` va por debajo de lo que cabría —caben unos 27— porque el
 * texto rompe por PALABRAS: una palabra que no entra se lleva la línea entera.
 * Quedarse corto sobra un poco de aire; pasarse recortaría una idea a media
 * frase.
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
  /** A partir de aquí se recorta: el Nodo entero se lee en la Vista Registro. */
  maxLines: 3,
} as const;

/**
 * Cuántas líneas ocupa un texto.
 *
 * Un Nodo sin texto ocupa una: enseña el marcador «Escribe tu idea…», que
 * también hay que poder leer.
 */
export function nodeLines(text: string): number {
  const content = text.trim();
  if (content.length === 0) return 1;

  // Los saltos de línea cuentan: el campo del Registro es un `textarea` y una
  // idea escrita en tres renglones ocupa tres.
  const wrapped = content
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / CANVAS_NODE.charsPerLine)),
      0,
    );

  return Math.min(wrapped, CANVAS_NODE.maxLines);
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
  if (content.width <= 0 || content.height <= 0 || usableWidth <= 0 || usableHeight <= 0) {
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
    size <= available ? (available - size) / 2 + CANVAS_PADDING : CANVAS_PADDING;

  return {
    x: place(content.width * zoom, usableWidth),
    y: place(content.height * zoom, usableHeight),
    zoom,
  };
}
