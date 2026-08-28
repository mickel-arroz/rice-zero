import { describe, expect, it } from "vitest";

import { REPARENT_RULES } from "@/lib/tree/model";
import { treeRows, reparentTargets, subtreeRows } from "@/lib/tree/rows";
import { treeNode } from "@/lib/tree/testing";

/**
 * El árbol de las pruebas, dibujado como lo pinta la Vista Registro:
 *
 *   r1
 *   ├─ a
 *   │  ├─ a1
 *   │  └─ a2
 *   ├─ b
 *   │  └─ b1
 *   └─ c
 *   r2
 *
 * Tiene lo que hace falta para que los raíles importen: un antepasado con
 * hermanos pendientes (`a`, con `b` y `c` detrás), otro sin ellos (`c`), y dos
 * raíces, porque una Versión admite varias.
 */
function sample() {
  return [
    treeNode("r1", null, 0),
    treeNode("a", "r1", 0),
    treeNode("a1", "a", 0),
    treeNode("a2", "a", 1),
    treeNode("b", "r1", 1),
    treeNode("b1", "b", 0),
    treeNode("c", "r1", 2),
    treeNode("r2", null, 1),
  ];
}

describe("treeRows", () => {
  it("no devuelve filas para una Versión sin Nodos", () => {
    expect(treeRows([])).toEqual([]);
  });

  it("aplana el bosque en el orden en que se lee", () => {
    expect(treeRows(sample()).map((row) => row.node.id)).toEqual([
      "r1",
      "a",
      "a1",
      "a2",
      "b",
      "b1",
      "c",
      "r2",
    ]);
  });

  it("aplana en el orden del árbol aunque la lista llegue desordenada", () => {
    const shuffled = [...sample()].reverse();
    expect(treeRows(shuffled).map((row) => row.node.id)).toEqual(
      treeRows(sample()).map((row) => row.node.id),
    );
  });

  it("da la profundidad de cada Nodo", () => {
    const depths = Object.fromEntries(
      treeRows(sample()).map((row) => [row.node.id, row.depth]),
    );
    expect(depths).toEqual({ r1: 0, a: 1, a1: 2, a2: 2, b: 1, b1: 2, c: 1, r2: 0 });
  });

  it("baja un raíl por cada antepasado al que aún le quedan hermanos", () => {
    const rails = Object.fromEntries(
      treeRows(sample()).map((row) => [row.node.id, row.rails]),
    );
    expect(rails).toEqual({
      // Las raíces no cuelgan de nadie: no hay raíl a su izquierda.
      r1: [],
      r2: [],
      // `a` tiene a `b` y `c` detrás, así que su propio raíl sigue bajando.
      a: [true],
      // Bajo `a`: el raíl de `a` sigue (columna 0) y el de `a1` también,
      // porque `a2` viene después.
      a1: [true, true],
      // `a2` cierra la lista de `a`: su raíl para en el codo.
      a2: [true, false],
      b: [true],
      b1: [true, false],
      // `c` es el último de `r1`: nada sigue bajando por su columna.
      c: [false],
    });
  });

  it("marca quién tiene subnodos, para dibujarle la bajada", () => {
    const withChildren = treeRows(sample())
      .filter((row) => row.hasChildren)
      .map((row) => row.node.id);
    expect(withChildren).toEqual(["r1", "a", "b"]);
  });

  it("sitúa a cada Nodo entre sus hermanos", () => {
    const places = Object.fromEntries(
      treeRows(sample()).map((row) => [
        row.node.id,
        [row.index, row.siblingCount],
      ]),
    );
    expect(places).toEqual({
      r1: [0, 2],
      r2: [1, 2],
      a: [0, 3],
      b: [1, 3],
      c: [2, 3],
      a1: [0, 2],
      a2: [1, 2],
      b1: [0, 1],
    });
  });
});

describe("reparentTargets", () => {
  it("ofrece el árbol entero, en el mismo orden en que se lee", () => {
    expect(reparentTargets(sample(), "a").map((target) => target.node.id)).toEqual([
      "r1",
      "a",
      "a1",
      "a2",
      "b",
      "b1",
      "c",
      "r2",
    ]);
  });

  it("rechaza al propio Nodo y a sus subnodos, y dice por qué", () => {
    const rejected = Object.fromEntries(
      reparentTargets(sample(), "a")
        .filter((target) => target.rejection !== null)
        .map((target) => [target.node.id, target.rejection]),
    );
    expect(rejected).toEqual({
      a: REPARENT_RULES.cycle,
      a1: REPARENT_RULES.cycle,
      a2: REPARENT_RULES.cycle,
    });
  });

  it("señala el padre que ya tiene: no es un destino, es donde está", () => {
    const current = reparentTargets(sample(), "a").filter((target) => target.current);
    expect(current.map((target) => target.node.id)).toEqual(["r1"]);
  });

  it("no señala ningún padre actual cuando el Nodo ya es raíz", () => {
    expect(reparentTargets(sample(), "r1").some((target) => target.current)).toBe(
      false,
    );
  });

  it("deja pasar a los que no son ni él ni de los suyos", () => {
    const free = reparentTargets(sample(), "a")
      .filter((target) => target.rejection === null && !target.current)
      .map((target) => target.node.id);
    expect(free).toEqual(["b", "b1", "c", "r2"]);
  });

  it("no ofrece destinos para un Nodo que no está en esta Versión", () => {
    expect(reparentTargets(sample(), "fantasma")).toEqual([]);
  });
});

describe("subtreeRows", () => {
  it("se lleva al Nodo y a todo lo que cuelga de él", () => {
    expect(subtreeRows(sample(), "a").map((row) => row.node.id)).toEqual([
      "a",
      "a1",
      "a2",
    ]);
  });

  it("baja hasta el fondo, no solo un nivel", () => {
    expect(subtreeRows(sample(), "r1").map((row) => row.node.id)).toEqual([
      "r1",
      "a",
      "a1",
      "a2",
      "b",
      "b1",
      "c",
    ]);
  });

  it("se para en el primer Nodo que ya no es suyo", () => {
    // `b1` es el último de `b`; `c` viene detrás en la lista pero es tío suyo.
    expect(subtreeRows(sample(), "b").map((row) => row.node.id)).toEqual([
      "b",
      "b1",
    ]);
  });

  it("una hoja es ella sola", () => {
    expect(subtreeRows(sample(), "a1").map((row) => row.node.id)).toEqual(["a1"]);
  });

  it("el último Nodo del árbol no arrastra nada", () => {
    expect(subtreeRows(sample(), "r2").map((row) => row.node.id)).toEqual(["r2"]);
  });

  it("conserva la profundidad de cada fila, para poder sangrarla", () => {
    expect(subtreeRows(sample(), "a").map((row) => row.depth)).toEqual([1, 2, 2]);
  });

  it("un Nodo que no está en la Versión no tiene subárbol", () => {
    expect(subtreeRows(sample(), "fantasma")).toEqual([]);
  });
});
