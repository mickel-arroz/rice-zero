import { describe, expect, it } from "vitest";

import {
  collapsedKey,
  expandedKey,
  foldedIds,
  pruneExpanded,
  readFolds,
  writeFolds,
  emptyFolds,
  parseIds,
  serializeIds,
  toggleFold,
  type Folds,
} from "@/lib/tree/collapsed";
import { treeRows, type TreeRow } from "@/lib/tree/rows";
import { treeNode } from "@/lib/tree/testing";

describe("Dónde se guarda el plegado", () => {
  it("una clave por Versión", () => {
    // Cada Versión es un árbol completo e independiente: abrir otra no puede
    // heredar lo que se dobló en ésta.
    expect(collapsedKey("v1")).not.toEqual(collapsedKey("v2"));
    expect(collapsedKey("v1")).toContain("v1");
  });
});

describe("Leer lo guardado", () => {
  it("lo escrito se vuelve a leer igual", () => {
    const ids = new Set(["b", "a"]);
    expect(parseIds(serializeIds(ids))).toEqual(ids);
  });

  it("se escribe ordenado, para que el mismo conjunto dé la misma cadena", () => {
    expect(serializeIds(["b", "a"])).toEqual(serializeIds(["a", "b"]));
  });

  it.each([
    ["nada guardado todavía", null],
    ["la cadena vacía", ""],
    ["a medio escribir", '["a"'],
    ["que no es una lista", '{"a":true}'],
    ["una lista de otra cosa", "[1,2,3]"],
  ])("%s cuenta como nada plegado", (_caso, raw) => {
    // El peor resultado posible sería un árbol que se abre con ramas
    // escondidas por un dato corrupto y sin decir por qué.
    expect(parseIds(raw)).toEqual(new Set());
  });

  it("de una lista mixta se queda con las cadenas", () => {
    expect(parseIds('["a",7,"b",null]')).toEqual(new Set(["a", "b"]));
  });
});

/**
 *   r1
 *   ├─ a     (completado)
 *   │  └─ a1
 *   ├─ b
 *   │  └─ b1
 *   └─ c     (completado, sin hijos)
 */
function rowsWith(completed: string[]) {
  return treeRows(
    [
      treeNode("r1", null, 0),
      treeNode("a", "r1", 0),
      treeNode("a1", "a", 0),
      treeNode("b", "r1", 1),
      treeNode("b1", "b", 0),
      treeNode("c", "r1", 2),
    ].map((node) =>
      completed.includes(node.id) ? { ...node, completed: true } : node,
    ),
  );
}

const rowOf = (rows: TreeRow[], id: string) =>
  rows.find((row) => row.node.id === id)!;

const none: Folds = { collapsed: new Set(), expanded: new Set() };

describe("Qué se ve plegado", () => {
  it("un Nodo completado con hijos nace plegado", () => {
    expect(foldedIds(rowsWith(["a"]), none)).toEqual(new Set(["a"]));
  });

  it("un Nodo completado sin hijos no cambia", () => {
    expect(foldedIds(rowsWith(["c"]), none)).toEqual(new Set());
  });

  it("los plegados manuales de Nodos pendientes siguen igual", () => {
    const folds = { collapsed: new Set(["b"]), expanded: new Set<string>() };
    expect(foldedIds(rowsWith([]), folds)).toEqual(new Set(["b"]));
  });

  it("desplegado a mano, un Nodo completado se ve abierto", () => {
    const folds = { collapsed: new Set<string>(), expanded: new Set(["a"]) };
    expect(foldedIds(rowsWith(["a"]), folds)).toEqual(new Set());
  });

  it("un desplegado de un Nodo pendiente no hace nada", () => {
    const folds = { collapsed: new Set<string>(), expanded: new Set(["b"]) };
    expect(foldedIds(rowsWith([]), folds)).toEqual(new Set());
  });
});

describe("Plegar y desplegar a mano", () => {
  it("desplegar un completado lo recuerda como excepción", () => {
    const rows = rowsWith(["a"]);
    const next = toggleFold(none, rowOf(rows, "a"));
    expect(foldedIds(rows, next)).toEqual(new Set());
    expect(next.expanded).toEqual(new Set(["a"]));
  });

  it("volver a plegarlo deja de ser excepción", () => {
    const rows = rowsWith(["a"]);
    const open = toggleFold(none, rowOf(rows, "a"));
    const back = toggleFold(open, rowOf(rows, "a"));
    expect(foldedIds(rows, back)).toEqual(new Set(["a"]));
    expect(back).toEqual(none);
  });

  it("desplegar un completado que ya estaba plegado a mano lo abre", () => {
    // Plegado cuando estaba pendiente, completado después: un solo clic
    // tiene que abrirlo, no gastar el primero en olvidar el plegado manual.
    const rows = rowsWith(["a"]);
    const folds = { collapsed: new Set(["a"]), expanded: new Set<string>() };
    expect(foldedIds(rows, toggleFold(folds, rowOf(rows, "a")))).toEqual(
      new Set(),
    );
  });

  it("un Nodo pendiente se pliega y despliega como siempre", () => {
    const rows = rowsWith([]);
    const folded = toggleFold(none, rowOf(rows, "b"));
    expect(folded.collapsed).toEqual(new Set(["b"]));
    expect(toggleFold(folded, rowOf(rows, "b"))).toEqual(none);
  });

  it("no toca los conjuntos que recibe", () => {
    const rows = rowsWith(["a"]);
    const antes: Folds = { collapsed: new Set(["b"]), expanded: new Set() };
    toggleFold(antes, rowOf(rows, "a"));
    expect(antes).toEqual({ collapsed: new Set(["b"]), expanded: new Set() });
  });
});

describe("Desmarcar olvida la excepción", () => {
  it("volver a completarlo lo pliega de nuevo", () => {
    // Desmarcado —aquí o en otro dispositivo—: el árbol llega con `a` pendiente.
    const opened = { collapsed: new Set<string>(), expanded: new Set(["a"]) };
    const forgotten = pruneExpanded(opened, rowsWith([]));
    expect(forgotten.expanded).toEqual(new Set());
    expect(foldedIds(rowsWith(["a"]), forgotten)).toEqual(new Set(["a"]));
  });

  it("mientras siga completado, la excepción se conserva", () => {
    const opened = { collapsed: new Set<string>(), expanded: new Set(["a"]) };
    expect(pruneExpanded(opened, rowsWith(["a"]))).toBe(opened);
  });

  it("un Nodo que no está en el árbol no dice nada", () => {
    // Árbol sin cargar todavía, u otra Versión mientras se cambia: borrar ahí
    // perdería lo guardado sin que nadie desmarcara nada.
    const opened = { collapsed: new Set<string>(), expanded: new Set(["a"]) };
    expect(pruneExpanded(opened, [])).toBe(opened);
  });

  it("sin excepción que olvidar, devuelve lo mismo", () => {
    // Mismo objeto: así React no repinta ni se reescribe lo guardado.
    expect(pruneExpanded(none, rowsWith([]))).toBe(none);
  });
});

describe("Dónde se guarda el desplegado", () => {
  it("una clave por Versión, distinta de la del plegado", () => {
    expect(expandedKey("v1")).not.toEqual(expandedKey("v2"));
    expect(expandedKey("v1")).not.toEqual(collapsedKey("v1"));
  });

  it("lo escrito se vuelve a leer igual, tras recargar", () => {
    const storage = new Map<string, string>();
    const fake = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    };
    const folds = { collapsed: new Set(["b"]), expanded: new Set(["a"]) };
    writeFolds(fake, "v1", folds);
    expect(readFolds(fake, "v1")).toEqual(folds);
    expect(readFolds(fake, "v2")).toEqual(emptyFolds());
  });

  it("lo guardado antes de existir el desplegado se sigue leyendo", () => {
    const fake = {
      getItem: (key: string) =>
        key === collapsedKey("v1") ? '["b"]' : null,
      setItem: () => {},
    };
    expect(readFolds(fake, "v1")).toEqual({
      collapsed: new Set(["b"]),
      expanded: new Set(),
    });
  });
});
