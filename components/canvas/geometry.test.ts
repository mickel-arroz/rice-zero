import { describe, expect, it } from "vitest";

import {
  CANVAS_NODE,
  CANVAS_PADDING,
  CANVAS_ZOOM,
  fitViewport,
  nodeLines,
  nodeSize,
} from "@/components/canvas/geometry";

describe("nodeLines", () => {
  it("un Nodo sin texto ocupa una línea", () => {
    // No es un caso raro: un Nodo nace vacío y lo primero que se ve de él es
    // el marcador «Escribe tu idea…», que también hay que poder leer.
    expect(nodeLines("")).toBe(1);
    expect(nodeLines("   \n  ")).toBe(1);
  });

  it("un texto corto cabe en una línea", () => {
    expect(nodeLines("Checkout")).toBe(1);
  });

  it("un texto largo se reparte en varias", () => {
    expect(nodeLines("x".repeat(CANVAS_NODE.charsPerLine + 1))).toBe(2);
  });

  it("no hay tope: un texto largo ocupa todas las líneas que necesita", () => {
    // Lo hubo —tres, y a partir de ahí puntos suspensivos— y era lo que
    // obligaba a abrir un Nodo para saber qué decía (#48).
    expect(nodeLines("x".repeat(CANVAS_NODE.charsPerLine * 20))).toBe(20);
  });

  it("la estimación se queda CORTA de caracteres, nunca larga", () => {
    // Es lo único que sostiene el dibujo desde que no hay recorte: si la
    // cuenta se pasara, el texto desbordaría la caja por abajo y taparía al
    // hermano de al lado. Una línea de justo `charsPerLine` sigue siendo una.
    expect(nodeLines("x".repeat(CANVAS_NODE.charsPerLine))).toBe(1);
    expect(nodeLines("x".repeat(CANVAS_NODE.charsPerLine + 1))).toBe(2);
  });

  it("cada salto de línea cuenta como una línea", () => {
    expect(nodeLines("uno\ndos")).toBe(2);
  });
});

describe("nodeSize", () => {
  it("el ancho es fijo y el alto sale de las líneas", () => {
    expect(nodeSize("Checkout")).toEqual({
      width: CANVAS_NODE.width,
      height: CANVAS_NODE.padding + CANVAS_NODE.lineHeight,
    });
  });

  it("el alto crece con el texto, y el ancho no se mueve", () => {
    const tall = nodeSize("x".repeat(CANVAS_NODE.charsPerLine * 20));

    expect(tall.height).toBe(CANVAS_NODE.padding + 20 * CANVAS_NODE.lineHeight);
    // La dimensión estable que el layout automático necesita para colocar.
    expect(tall.width).toBe(CANVAS_NODE.width);
  });
});

describe("fitViewport", () => {
  /** Un lienzo de escritorio, ya descontado el aire de los bordes. */
  const pane = {
    width: 1000 + CANVAS_PADDING * 2,
    height: 600 + CANVAS_PADDING * 2,
  };

  it("un bosque pequeño se queda a tamaño real y centrado", () => {
    // No se AMPLÍA para llenar: un árbol de dos Nodos ocupando la pantalla
    // entera con letras gigantes no es más legible, es más raro.
    const view = fitViewport({ width: 400, height: 200 }, pane);

    expect(view.zoom).toBe(1);
    expect(view.x).toBe((1000 - 400) / 2 + CANVAS_PADDING);
    expect(view.y).toBe((600 - 200) / 2 + CANVAS_PADDING);
  });

  it("un bosque grande se aleja hasta que cabe, y sigue centrado", () => {
    // 1250 de ancho en 1000 útiles → 0,8, que aún es legible. Al alejarse, el
    // alto pasa a 480 y sobra sitio: sigue centrado en vertical.
    const view = fitViewport({ width: 1250, height: 600 }, pane);

    expect(view.zoom).toBe(0.8);
    expect(view.x).toBe(CANVAS_PADDING);
    expect(view.y).toBe((600 - 480) / 2 + CANVAS_PADDING);
  });

  it("nunca se aleja por debajo del mínimo legible", () => {
    // Diez mil píxeles de alto es una raíz con muchos subnodos, nada exótico.
    const view = fitViewport({ width: 400, height: 10_000 }, pane);

    expect(view.zoom).toBe(CANVAS_ZOOM.fitMin);
  });

  it("lo que no cabe se ancla al borde: se abre por el PRINCIPIO del bosque", () => {
    // Es la razón de que esta función exista. Centrar un bosque que no cabe
    // deja la primera raíz fuera de pantalla y arrancas leyendo por la mitad.
    const view = fitViewport({ width: 400, height: 10_000 }, pane);

    expect(view.y).toBe(CANVAS_PADDING);
  });

  it("un lienzo todavía sin medir no mueve nada", () => {
    // Pasa en el primer render, antes de que el navegador mida la caja.
    expect(fitViewport({ width: 400, height: 200 }, { width: 0, height: 0 })).toEqual({
      x: CANVAS_PADDING,
      y: CANVAS_PADDING,
      zoom: 1,
    });
  });
});
