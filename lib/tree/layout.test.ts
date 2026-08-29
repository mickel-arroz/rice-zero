import { describe, expect, it } from "vitest";

import type { TreeNode } from "@/lib/backend/ports";
import {
  LAYOUT_GAPS,
  layoutForest,
  treeEdges,
  type NodeBox,
} from "@/lib/tree/layout";
import { treeNode } from "@/lib/tree/testing";

/**
 * El bosque de las pruebas:
 *
 *   r1 ─┬─ a ─┬─ a1
 *       │     └─ a2
 *       ├─ b ─── b1
 *       └─ c
 *   r2 ─── d
 *   r3
 *
 * Tres raíces porque es EL caso que el ticket pide sostener («auto-layout
 * correcto con múltiples raíces»), profundidad 2 para que haya tres columnas,
 * y una raíz suelta al final para que la última no sea la más alta — un
 * apilado que solo funcione con subárboles del mismo tamaño pasaría un test
 * hecho con dos ramas gemelas.
 */
function sample(): TreeNode[] {
  return [
    treeNode("r1", null, 0),
    treeNode("a", "r1", 0),
    treeNode("a1", "a", 0),
    treeNode("a2", "a", 1),
    treeNode("b", "r1", 1),
    treeNode("b1", "b", 0),
    treeNode("c", "r1", 2),
    treeNode("r2", null, 1),
    treeNode("d", "r2", 0),
    treeNode("r3", null, 2),
  ];
}

/** Todos los Nodos miden lo mismo: aquí se prueba la colocación, no el texto. */
const uniform = () => ({ width: 200, height: 40 });

function boxOf(boxes: NodeBox[], id: string): NodeBox {
  const box = boxes.find((candidate) => candidate.id === id);
  if (!box) throw new Error(`No se colocó «${id}»`);
  return box;
}

/** ¿Se pisan dos cajas? Se tocan por el borde NO cuenta. */
function overlaps(a: NodeBox, b: NodeBox): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function eachPair(boxes: NodeBox[]): [NodeBox, NodeBox][] {
  const pairs: [NodeBox, NodeBox][] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) pairs.push([boxes[i], boxes[j]]);
  }
  return pairs;
}

describe("layoutForest", () => {
  it("un árbol vacío no coloca nada y no ocupa nada", () => {
    expect(layoutForest([], uniform)).toEqual({ boxes: [], width: 0, height: 0 });
  });

  it("un solo Nodo arranca en el origen y su envolvente es él mismo", () => {
    const layout = layoutForest([treeNode("solo", null, 0)], uniform);

    expect(layout.boxes).toEqual([
      { id: "solo", x: 0, y: 0, width: 200, height: 40 },
    ]);
    expect(layout).toMatchObject({ width: 200, height: 40 });
  });

  it("la profundidad crece hacia la derecha, un nivel por columna", () => {
    const { boxes } = layoutForest(sample(), uniform);

    const r1 = boxOf(boxes, "r1");
    const a = boxOf(boxes, "a");
    const a1 = boxOf(boxes, "a1");

    // Cada columna arranca donde acaba la anterior más el aire entre niveles.
    expect(a.x).toBe(r1.x + 200 + LAYOUT_GAPS.rank);
    expect(a1.x).toBe(a.x + 200 + LAYOUT_GAPS.rank);
    // Todos los de un nivel comparten columna: es lo que hace legible el árbol.
    expect(boxOf(boxes, "b").x).toBe(a.x);
    expect(boxOf(boxes, "c").x).toBe(a.x);
    expect(boxOf(boxes, "b1").x).toBe(a1.x);
  });

  it("los hermanos bajan en el orden del árbol", () => {
    const { boxes } = layoutForest(sample(), uniform);

    // El criterio de aceptación real: la barra de acciones es la misma en las
    // dos vistas, así que «Subir» tiene que mover al Nodo hacia arriba TAMBIÉN
    // aquí. Si el motor reordenara hermanos por su cuenta, el botón movería el
    // Nodo en una dirección que no es la que se ve.
    expect(boxOf(boxes, "a").y).toBeLessThan(boxOf(boxes, "b").y);
    expect(boxOf(boxes, "b").y).toBeLessThan(boxOf(boxes, "c").y);
    expect(boxOf(boxes, "a1").y).toBeLessThan(boxOf(boxes, "a2").y);
  });

  it("las raíces se apilan en orden y sus subárboles no se mezclan", () => {
    const { boxes } = layoutForest(sample(), uniform);

    /** El alto que ocupa una raíz con todo lo que cuelga de ella. */
    function band(ids: string[]) {
      const own = ids.map((id) => boxOf(boxes, id));
      return {
        top: Math.min(...own.map((box) => box.y)),
        bottom: Math.max(...own.map((box) => box.y + box.height)),
      };
    }

    const first = band(["r1", "a", "a1", "a2", "b", "b1", "c"]);
    const second = band(["r2", "d"]);
    const third = band(["r3"]);

    // Bandas disjuntas y en el orden de las raíces: un bosque no es un grafo
    // desconectado que se empaqueta como quepa, son ideas sueltas que se leen
    // de arriba abajo.
    expect(second.top).toBe(first.bottom + LAYOUT_GAPS.root);
    expect(third.top).toBe(second.bottom + LAYOUT_GAPS.root);
  });

  it("ningún Nodo se pisa con otro, ni con alturas distintas", () => {
    // Alturas dispares a propósito: un Nodo es texto libre y crece hacia abajo.
    const heights: Record<string, number> = { a: 120, b1: 90, r2: 200 };
    const layout = layoutForest(sample(), (node) => ({
      width: 200,
      height: heights[node.id] ?? 40,
    }));

    for (const [one, other] of eachPair(layout.boxes)) {
      expect(
        overlaps(one, other),
        `«${one.id}» y «${other.id}» se pisan`,
      ).toBe(false);
    }
  });

  it("un padre más alto que sus hijos no se sube encima del hermano de arriba", () => {
    // Centrar un padre sobre los suyos lo empuja hacia ARRIBA cuando él es más
    // alto que la franja que ocupan, y ahí es donde vive su hermano anterior.
    // Pasa en cuanto un Nodo de tres líneas cuelga de uno de una: no es un
    // caso de laboratorio, es texto largo con un subnodo corto.
    const nodes = [
      treeNode("r", null, 0),
      treeNode("corto", "r", 0),
      treeNode("largo", "r", 1),
      treeNode("suyo", "largo", 0),
    ];
    const layout = layoutForest(nodes, (node) => ({
      width: 200,
      height: node.id === "largo" ? 300 : 40,
    }));

    const corto = boxOf(layout.boxes, "corto");
    const largo = boxOf(layout.boxes, "largo");

    expect(corto.x).toBe(largo.x);
    expect(largo.y).toBeGreaterThanOrEqual(corto.y + corto.height);
  });

  it("la envolvente contiene todas las cajas y arranca en el origen", () => {
    const layout = layoutForest(sample(), uniform);

    expect(Math.min(...layout.boxes.map((box) => box.x))).toBe(0);
    expect(Math.min(...layout.boxes.map((box) => box.y))).toBe(0);
    expect(Math.max(...layout.boxes.map((box) => box.x + box.width))).toBe(
      layout.width,
    );
    expect(Math.max(...layout.boxes.map((box) => box.y + box.height))).toBe(
      layout.height,
    );
  });

  it("el mismo árbol da el mismo dibujo, llegue como llegue la lista", () => {
    // El árbol se relee entero después de cada escritura de estructura, y el
    // backend no promete un orden de filas. Si el dibujo dependiera de él, el
    // Canvas daría un salto tras cada cambio sin que nada se hubiera movido.
    const straight = layoutForest(sample(), uniform);
    const shuffled = layoutForest([...sample()].reverse(), uniform);

    expect(shuffled).toEqual(straight);
  });

  it("un Nodo cuyo padre no está en la lista se coloca como raíz", () => {
    // No debería pasar con la FK puesta, pero si pasa el Nodo aparece suelto en
    // vez de desaparecer del lienzo sin que nadie se entere. Mismo criterio que
    // `buildTree`.
    const { boxes } = layoutForest(
      [treeNode("r", null, 0), treeNode("huérfano", "fantasma", 0)],
      uniform,
    );

    expect(boxes.map((box) => box.id).sort()).toEqual(["huérfano", "r"]);
    expect(boxOf(boxes, "huérfano").x).toBe(0);
  });

  it("coloca a TODOS los Nodos, incluso a un ciclo ya persistido", () => {
    // `reparentRejection` y la restricción del motor lo impiden, así que esto
    // solo puede llegar de una escritura a mano. Aun así se dibuja: la promesa
    // es que lo que está en la Versión está en el lienzo, y una idea que
    // desaparece de la pantalla no se puede ni siquiera arreglar.
    const cycle = [treeNode("x", "y", 0), treeNode("y", "x", 0)];

    expect(layoutForest(cycle, uniform).boxes).toHaveLength(2);
  });
});

describe("treeEdges", () => {
  it("da un enlace por cada Nodo que cuelga de otro", () => {
    const edges = treeEdges(sample());

    expect(edges).toHaveLength(7);
    expect(edges).toContainEqual({ id: "r1->a", source: "r1", target: "a" });
    expect(edges.some((edge) => edge.target === "r1")).toBe(false);
  });

  it("no dibuja un enlace hacia un padre que no está en la lista", () => {
    // Un enlace colgando de la nada es un fallo del lienzo, no un aviso: se
    // omite, y el Nodo ya sale como raíz por `layoutForest`.
    expect(treeEdges([treeNode("huérfano", "fantasma", 0)])).toEqual([]);
  });
});
