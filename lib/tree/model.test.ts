/**
 * El dominio del árbol, sin I/O.
 *
 * Todo lo que se comprueba aquí entra por una lista plana de Nodos —la misma
 * forma que devuelve `nodes.listByVersion`— y sale como estructura o como
 * plan de escritura. Ningún test toca un backend: si alguno lo necesitara,
 * sería la señal de que la regla se ha escapado del módulo.
 */

import { describe, expect, it } from "vitest";

import {
  buildTree,
  countDescendants,
  REPARENT_RULES,
  nextOrderIndex,
  reorderPlan,
  reparentRejection,
  siblingIndexOf,
} from "@/lib/tree/model";
import type { TreeNode } from "@/lib/backend/ports";
import { treeNode as node } from "@/lib/tree/testing";

describe("dominio del árbol: construir", () => {
  it("admite varias raíces, ordenadas entre ellas", () => {
    const roots = buildTree([node("b", null, 1), node("a", null, 0)]);

    expect(roots.map((root) => root.node.id)).toEqual(["a", "b"]);
  });

  it("cuelga los hijos de su padre, en orden", () => {
    const roots = buildTree([
      node("raiz", null, 0),
      node("segundo", "raiz", 1),
      node("primero", "raiz", 0),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0].children.map((child) => child.node.id)).toEqual([
      "primero",
      "segundo",
    ]);
  });
});

/** Un árbol con dos raíces y profundidad 3, para las reglas de más abajo. */
function forest(): TreeNode[] {
  return [
    node("a", null, 0),
    node("a1", "a", 0),
    node("a2", "a", 1),
    node("a1x", "a1", 0),
    node("b", null, 1),
  ];
}

describe("dominio del árbol: contar descendientes", () => {
  it("cuenta el subárbol entero, no solo los hijos", () => {
    expect(countDescendants(forest(), "a")).toBe(3);
  });

  it("una hoja no arrastra a nadie", () => {
    expect(countDescendants(forest(), "b")).toBe(0);
  });

  it("un id que no está en el árbol no arrastra a nadie", () => {
    expect(countDescendants(forest(), "fantasma")).toBe(0);
  });
});

describe("dominio del árbol: re-parentar", () => {
  it("acepta mover un Nodo bajo otro subárbol", () => {
    expect(reparentRejection(forest(), "a1", "b")).toBeNull();
  });

  it("acepta soltar un Nodo como raíz", () => {
    expect(reparentRejection(forest(), "a1", null)).toBeNull();
  });

  it("rechaza colgar un Nodo de sí mismo", () => {
    expect(reparentRejection(forest(), "a", "a")).toBe(REPARENT_RULES.cycle);
  });

  it("rechaza colgar un Nodo de un hijo suyo", () => {
    expect(reparentRejection(forest(), "a", "a1")).toBe(REPARENT_RULES.cycle);
  });

  it("rechaza colgar un Nodo de un descendiente lejano", () => {
    expect(reparentRejection(forest(), "a", "a1x")).toBe(REPARENT_RULES.cycle);
  });

  it("rechaza mover un Nodo que no está en la Versión", () => {
    expect(reparentRejection(forest(), "fantasma", "a")).toBe(
      REPARENT_RULES.unknownNode,
    );
  });

  it("rechaza colgar de un padre que no está en la Versión", () => {
    expect(reparentRejection(forest(), "a", "fantasma")).toBe(
      REPARENT_RULES.unknownParent,
    );
  });

  it("dejar un Nodo donde ya estaba no es un rechazo", () => {
    expect(reparentRejection(forest(), "a1", "a")).toBeNull();
  });
});

describe("dominio del árbol: orden entre hermanos", () => {
  it("un hijo nuevo se pone el último", () => {
    expect(nextOrderIndex(forest(), "a")).toBe(2);
  });

  it("el primer hijo de un Nodo sin hijos abre en cero", () => {
    expect(nextOrderIndex(forest(), "b")).toBe(0);
  });

  it("una raíz nueva se pone la última de las raíces", () => {
    expect(nextOrderIndex(forest(), null)).toBe(2);
  });

  it("mover un hermano hacia arriba reescribe solo a los que se mueven", () => {
    const nodes = [
      node("uno", null, 0),
      node("dos", null, 1),
      node("tres", null, 2),
    ];

    expect(reorderPlan(nodes, "tres", 0)).toEqual([
      { id: "tres", orderIndex: 0 },
      { id: "uno", orderIndex: 1 },
      { id: "dos", orderIndex: 2 },
    ]);
  });

  it("dejarlo donde estaba no escribe nada", () => {
    const nodes = [node("uno", null, 0), node("dos", null, 1)];

    expect(reorderPlan(nodes, "dos", 1)).toEqual([]);
  });

  it("compacta índices con huecos aunque nadie cambie de sitio", () => {
    const nodes = [node("uno", null, 0), node("dos", null, 7)];

    expect(reorderPlan(nodes, "dos", 1)).toEqual([{ id: "dos", orderIndex: 1 }]);
  });

  it("un destino más allá del final deja el Nodo el último", () => {
    const nodes = [node("uno", null, 0), node("dos", null, 1)];

    expect(reorderPlan(nodes, "uno", 99)).toEqual([
      { id: "dos", orderIndex: 0 },
      { id: "uno", orderIndex: 1 },
    ]);
  });

  it("un destino negativo deja el Nodo el primero", () => {
    const nodes = [node("uno", null, 0), node("dos", null, 1)];

    expect(reorderPlan(nodes, "dos", -3)).toEqual([
      { id: "dos", orderIndex: 0 },
      { id: "uno", orderIndex: 1 },
    ]);
  });

  it("solo reordena entre hermanos: los de otro padre no se tocan", () => {
    const plan = reorderPlan(forest(), "a2", 0);

    expect(plan.map((write) => write.id).sort()).toEqual(["a1", "a2"]);
  });

  it("un Nodo que no está en la Versión no genera plan", () => {
    expect(reorderPlan(forest(), "fantasma", 0)).toEqual([]);
  });
});

describe("dominio del árbol: sitio entre hermanos", () => {
  it("da la posición de un Nodo entre los suyos", () => {
    expect(siblingIndexOf(forest(), "a2")).toBe(1);
  });

  it("cuenta a las raíces como hermanas entre sí", () => {
    expect(siblingIndexOf(forest(), "b")).toBe(1);
  });

  it("va por el orden del árbol, no por el `orderIndex` guardado", () => {
    // Índices con hueco: `a1` sigue siendo el primero de los dos.
    const nodes = [node("a", null, 0), node("a1", "a", 5), node("a2", "a", 9)];

    expect(siblingIndexOf(nodes, "a2")).toBe(1);
  });

  it("un Nodo que no está en la Versión no tiene sitio", () => {
    expect(siblingIndexOf(forest(), "fantasma")).toBe(-1);
  });
});
