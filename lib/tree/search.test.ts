import { describe, expect, it } from "vitest";

import { treeRows } from "@/lib/tree/rows";
import { isSearching, matches, searchRows } from "@/lib/tree/search";
import { treeNode } from "@/lib/tree/testing";

/**
 *   Tienda online
 *   ├─ Catálogo
 *   │  └─ Filtros por talla
 *   └─ Carrito
 *   Análisis de la competencia
 */
function sample() {
  return treeRows([
    treeNode("a", null, 0, "Tienda online"),
    treeNode("a1", "a", 0, "Catálogo"),
    treeNode("a1x", "a1", 0, "Filtros por talla"),
    treeNode("a2", "a", 1, "Carrito"),
    treeNode("b", null, 1, "Análisis de la competencia"),
  ]);
}

function idsFor(query: string) {
  return searchRows(sample(), query).map((hit) => hit.row.node.id);
}

describe("qué cuenta como coincidencia", () => {
  it("es una subcadena, no una palabra entera", () => {
    // Quien teclea «tecl» quiere ver «teclado» antes de terminar la palabra:
    // es lo que hace que filtrar mientras se escribe valga la pena.
    expect(matches("Filtros por talla", "tall")).toBe(true);
  });

  it("no distingue mayúsculas", () => {
    expect(matches("Carrito", "CARRITO")).toBe(true);
  });

  it("no distingue tildes: la app se escribe en español", () => {
    // Hacer que la tilde importe convierte la Búsqueda en un examen de
    // ortografía.
    expect(matches("Análisis", "analisis")).toBe(true);
    expect(matches("Catalogo", "catálogo")).toBe(true);
  });

  it("pero la eñe sigue siendo una letra", () => {
    // «año» y «ano» no son la misma palabra.
    expect(matches("año", "ano")).toBe(false);
  });
});

describe("filtrar la Versión", () => {
  it("devuelve los Nodos que contienen lo buscado, en orden de lectura", () => {
    expect(idsFor("a")).toEqual(["a", "a1", "a1x", "a2", "b"]);
    expect(idsFor("carr")).toEqual(["a2"]);
  });

  it("una Búsqueda en blanco no devuelve nada: no está filtrando", () => {
    // La pantalla enseña el árbol entero, no una lista de todo.
    expect(idsFor("")).toEqual([]);
    expect(idsFor("   ")).toEqual([]);
  });

  it("sin coincidencias devuelve la lista vacía", () => {
    expect(idsFor("pasarela de pago")).toEqual([]);
  });

  it("cada resultado trae el camino que lo sitúa", () => {
    // La lista rompe el árbol —los Nodos salen sueltos, sin sus líneas— y sin
    // esto tres coincidencias parecidas serían indistinguibles.
    const [hit] = searchRows(sample(), "talla");
    expect(hit.ancestors).toEqual(["Tienda online", "Catálogo"]);
  });

  it("una raíz no tiene camino", () => {
    const [hit] = searchRows(sample(), "competencia");
    expect(hit.ancestors).toEqual([]);
  });

  it("el camino no arrastra el de un hermano anterior", () => {
    // La pila se indexa por profundidad y se pisa, no se apila: sin eso,
    // «Carrito» heredaría a «Catálogo» como antepasado por haber ido detrás.
    const [hit] = searchRows(sample(), "carrito");
    expect(hit.ancestors).toEqual(["Tienda online"]);
  });
});

describe("isSearching", () => {
  it("solo con algo escrito", () => {
    expect(isSearching("")).toBe(false);
    expect(isSearching("  \n ")).toBe(false);
    expect(isSearching("a")).toBe(true);
  });
});
