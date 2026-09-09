import { describe, expect, it } from "vitest";

import {
  applyUpdated,
  followUp,
  isOptimistic,
  optimisticId,
  optimisticNode,
  settleOptimistic,
  withOptimistic,
  withoutSubtree,
  type TreeWrite,
} from "@/lib/tree/write-policy";
import { treeNode } from "@/lib/tree/testing";

describe("qué se relee y qué no", () => {
  it.each<TreeWrite>(["createSibling", "reorder", "reparent"])(
    "«%s» relee: reparte puestos entre hermanos que nadie nombró",
    (write) => {
      expect(followUp(write)).toBe("reread");
    },
  );

  it.each<TreeWrite>(["create", "edit", "complete", "remove"])(
    "«%s» se resuelve en local: solo cambia la fila que se tocó",
    (write) => {
      expect(followUp(write)).toBe("local");
    },
  );

  it("crear a secas NO relee, y crear un hermano SÍ", () => {
    // Es la distinción que sostiene el Nodo optimista, y la más fácil de
    // perder: las dos «crean». Crear un hermano son dos escrituras —nace el
    // último y después se le trae a su sitio— y la segunda renumera a los
    // demás, que no vuelven en ninguna respuesta.
    expect(followUp("create")).toBe("local");
    expect(followUp("createSibling")).toBe("reread");
  });
});

describe("el Nodo optimista", () => {
  it("se reconoce por su id, y ningún id real lo parece", () => {
    expect(isOptimistic(optimisticId())).toBe(true);
    expect(isOptimistic("3f2a1c4e-0000-4000-8000-000000000000")).toBe(false);
  });

  it("cada uno es distinto: pueden convivir dos en vuelo", () => {
    expect(optimisticId()).not.toBe(optimisticId());
  });

  it("nace vacío, pendiente y donde va a nacer de verdad", () => {
    const draft = optimisticNode({
      id: "optimista:1",
      versionId: "v1",
      parentId: "p",
      orderIndex: 3,
    });

    expect(draft.content).toBe("");
    expect(draft.completed).toBe(false);
    expect(draft.parentId).toBe("p");
    // Si el puesto no coincidiera con el que le va a dar el motor, el Nodo
    // daría un salto al llegar la respuesta.
    expect(draft.orderIndex).toBe(3);
  });

  it("se añade al árbol sin tocar lo que había", () => {
    const nodes = [treeNode("a", null, 0)];
    const draft = optimisticNode({
      id: "optimista:9",
      versionId: "v1",
      parentId: null,
      orderIndex: 1,
    });

    expect(withOptimistic(nodes, draft)).toEqual([...nodes, draft]);
    expect(nodes).toHaveLength(1);
  });
});

describe("reconciliar con lo que devolvió el motor", () => {
  const temp = optimisticNode({
    id: "optimista:1",
    versionId: "v1",
    parentId: null,
    orderIndex: 1,
  });

  it("el temporal se sustituye por el real EN SU SITIO", () => {
    // El orden de la lista plana no decide nada del dibujo, pero sí en qué
    // orden reconcilia React: mover la fila la desmonta, y con el campo abierto
    // dentro eso es perder el foco justo al empezar a escribir.
    const nodes = [treeNode("a", null, 0), temp, treeNode("b", null, 2)];
    const created = treeNode("real", null, 1);

    expect(settleOptimistic(nodes, temp.id, created).map((n) => n.id)).toEqual([
      "a",
      "real",
      "b",
    ]);
  });

  it("si la escritura falló, el temporal se va y el árbol queda como estaba", () => {
    const antes = [treeNode("a", null, 0)];
    const conNodo = withOptimistic(antes, temp);

    expect(withoutSubtree(conNodo, temp.id)).toEqual(antes);
  });

  it("una fila actualizada pisa a la que había, y solo a ella", () => {
    const nodes = [treeNode("a", null, 0, "Uno"), treeNode("b", null, 1, "Dos")];
    const updated = { ...nodes[0], completed: true };

    const after = applyUpdated(nodes, updated);
    expect(after[0].completed).toBe(true);
    expect(after[1]).toBe(nodes[1]);
  });
});

describe("borrar se lleva el subárbol", () => {
  /**
   *   a
   *   ├─ a1
   *   │  └─ a1x
   *   └─ a2
   *   b
   */
  function sample() {
    return [
      treeNode("a", null, 0),
      treeNode("a1", "a", 0),
      treeNode("a1x", "a1", 0),
      treeNode("a2", "a", 1),
      treeNode("b", null, 1),
    ];
  }

  it("se lleva a los hijos y a los nietos", () => {
    // La cascada es del motor (`on delete cascade` sobre `parent_id`), y esto
    // la reproduce sin volver a preguntar. Quedarse corto dejaría en pantalla
    // Nodos que ya no existen.
    expect(withoutSubtree(sample(), "a").map((n) => n.id)).toEqual(["b"]);
  });

  it("no se lleva a nadie que no cuelgue de él", () => {
    expect(withoutSubtree(sample(), "a1").map((n) => n.id)).toEqual([
      "a",
      "a2",
      "b",
    ]);
  });

  it("da igual el orden en que venga la lista plana", () => {
    // Un nieto puede aparecer antes que su padre: la lista no viene ordenada de
    // arriba abajo, y una sola pasada dejaría descendencia suelta.
    const revuelto = [...sample()].reverse();
    expect(withoutSubtree(revuelto, "a").map((n) => n.id)).toEqual(["b"]);
  });

  it("un id que no está no cambia nada", () => {
    expect(withoutSubtree(sample(), "fantasma")).toEqual(sample());
  });
});
