import { describe, expect, it } from "vitest";

import { boxAt, dropTargetAt } from "@/components/canvas/drop";
import { REPARENT_RULES } from "@/lib/tree/model";
import type { NodeBox } from "@/lib/tree/layout";
import { treeNode } from "@/lib/tree/testing";

/**
 * El bosque de estos tests, colocado a mano.
 *
 *   a (0,0)          →  b (300,0)  →  c (600,0)
 *   d (0,200)
 *
 * Las cajas se escriben aquí en vez de pedírselas a `layoutForest` a
 * propósito: lo que se prueba es «qué hay bajo este punto», no dónde decide
 * dagre poner nada. Un cambio en el reparto no puede romper estos tests.
 */
const BOXES: NodeBox[] = [
  { id: "a", x: 0, y: 0, width: 208, height: 42 },
  { id: "b", x: 300, y: 0, width: 208, height: 42 },
  { id: "c", x: 600, y: 0, width: 208, height: 42 },
  { id: "d", x: 0, y: 200, width: 208, height: 42 },
];

/** `a → b → c`, y `d` suelta. La misma forma que dibujan las cajas de arriba. */
const NODES = [
  treeNode("a", null, 0),
  treeNode("b", "a", 0),
  treeNode("c", "b", 0),
  treeNode("d", null, 1),
];

describe("boxAt", () => {
  it("un punto dentro de una caja la devuelve", () => {
    expect(boxAt(BOXES, { x: 100, y: 20 })?.id).toBe("a");
    expect(boxAt(BOXES, { x: 400, y: 20 })?.id).toBe("b");
  });

  it("un punto en el aire no es de nadie", () => {
    // El hueco entre dos Nodos es la mitad del lienzo: si esto devolviera algo,
    // arrastrar por encima del vacío marcaría un destino que no se ve.
    expect(boxAt(BOXES, { x: 250, y: 20 })).toBeNull();
    expect(boxAt(BOXES, { x: 100, y: 120 })).toBeNull();
  });

  it("el borde de arriba y el de la izquierda entran; los de enfrente, no", () => {
    // Media abierta, como un intervalo `[inicio, fin)`. Dos cajas pegadas no
    // pueden reclamar el mismo píxel, y hoy el layout nunca las pega — pero la
    // regla no depende de que siga siendo así.
    expect(boxAt(BOXES, { x: 0, y: 0 })?.id).toBe("a");
    expect(boxAt(BOXES, { x: 208, y: 0 })).toBeNull();
    expect(boxAt(BOXES, { x: 0, y: 42 })).toBeNull();
  });

  it("sin cajas no hay nada debajo", () => {
    expect(boxAt([], { x: 0, y: 0 })).toBeNull();
  });
});

describe("dropTargetAt", () => {
  it("un destino que vale sale sin rechazo", () => {
    // `c` colgando de `d`: no hay ciclo por ningún lado.
    expect(dropTargetAt(NODES, BOXES, "c", { x: 100, y: 220 })).toEqual({
      id: "d",
      rejection: null,
    });
  });

  it("soltar sobre un subnodo propio se rechaza por ciclo", () => {
    // `a` sobre `c`, que cuelga de `b`, que cuelga de `a`. Es EL caso que el
    // dominio existe para impedir, y aquí tiene que verse antes de soltar.
    expect(dropTargetAt(NODES, BOXES, "a", { x: 700, y: 20 })).toEqual({
      id: "c",
      rejection: REPARENT_RULES.cycle,
    });
  });

  it("el propio Nodo no es destino: soltarlo donde estaba no es un movimiento", () => {
    // Su caja sigue en el sitio del que salió mientras el dedo se lo lleva.
    // Marcarla como destino inválido sería teñir de rojo el hueco que acaba de
    // dejar, que es ruido: volver al punto de partida es cancelar.
    expect(dropTargetAt(NODES, BOXES, "a", { x: 100, y: 20 })).toBeNull();
  });

  it("sobre el vacío no hay destino", () => {
    // Y por eso soltar ahí no hace nada. Dejar un Nodo como raíz se pide en
    // «Mover a…», donde se elige a la vista y no por dónde acabó el dedo.
    expect(dropTargetAt(NODES, BOXES, "c", { x: 250, y: 400 })).toBeNull();
  });

  it("el padre actual vale: es un arrastre que acabó donde empezó", () => {
    // No es un no-movimiento que haya que impedir — `nodeService.reparent` ya
    // lo trata como tal. Enseñarlo como inválido diría que algo va mal.
    expect(dropTargetAt(NODES, BOXES, "b", { x: 100, y: 20 })).toEqual({
      id: "a",
      rejection: null,
    });
  });

  it("un Nodo que ya no está en el árbol no tiene destino", () => {
    // Pasa de verdad: el árbol se relee entero tras cada cambio de estructura,
    // y una relectura puede aterrizar con el dedo todavía abajo.
    expect(dropTargetAt(NODES, BOXES, "fantasma", { x: 100, y: 20 })).toEqual({
      id: "a",
      rejection: REPARENT_RULES.unknownNode,
    });
  });
});
