/**
 * La serialización del árbol a texto para la IA.
 *
 * Los primeros tests no fijan el FORMATO: comprueban las propiedades que
 * tienen que valer lo pinte como lo pinte —determinismo, jerarquía visible,
 * nada perdido—. El formato exacto lo fija el snapshot del final, que está
 * para que un cambio de forma se vea en el diff y se decida a propósito.
 */

import { describe, expect, it } from "vitest";

import type { TreeNode } from "@/lib/backend/ports";
import { EMPTY_NODE_PLACEHOLDER, serializeTree } from "@/lib/tree/serialize";
import { treeNode as node } from "@/lib/tree/testing";

/** Dos raíces, tres niveles: la forma mínima que ejercita todo el recorrido. */
function tree(): TreeNode[] {
  return [
    node("a", null, 0, "Tienda online"),
    node("a1", "a", 0, "Catálogo"),
    node("a1x", "a1", 0, "Filtros por talla"),
    node("a2", "a", 1, "Carrito"),
    node("b", null, 1, "Fuera de alcance"),
  ];
}

describe("serialización del árbol", () => {
  it("es determinista: el orden en que lleguen las filas da igual", () => {
    const straight = tree();
    const shuffled = [straight[3], straight[0], straight[4], straight[2], straight[1]];

    expect(serializeTree(shuffled)).toBe(serializeTree(straight));
  });

  it("no pierde el texto de ningún Nodo", () => {
    const text = serializeTree(tree());

    for (const { content } of tree()) expect(text).toContain(content);
  });

  it("respeta el orden entre hermanos", () => {
    const text = serializeTree(tree());

    expect(text.indexOf("Catálogo")).toBeLessThan(text.indexOf("Carrito"));
  });

  it("hunde a los hijos más que a su padre", () => {
    const lines = serializeTree(tree()).split("\n");
    const indent = (needle: string) => {
      const line = lines.find((candidate) => candidate.includes(needle)) as string;
      return line.length - line.trimStart().length;
    };

    expect(indent("Catálogo")).toBeGreaterThan(indent("Tienda online"));
    expect(indent("Filtros por talla")).toBeGreaterThan(indent("Catálogo"));
  });

  it("un Nodo vacío se anuncia en vez de dejar un hueco mudo", () => {
    const text = serializeTree([node("a", null, 0, "   ")]);

    expect(text).toContain(EMPTY_NODE_PLACEHOLDER);
  });

  it("un texto de varias líneas no rompe la jerarquía", () => {
    const lines = serializeTree([
      node("a", null, 0, "Primera\nSegunda"),
      node("a1", "a", 0, "Hijo"),
    ]).split("\n");

    // Lo que separa un Nodo de la continuación del anterior es el marcador,
    // no la sangría: con dos espacios de sangría y dos de marcador, alinear
    // una continuación bajo el texto de su padre la deja a la misma altura
    // que sus hijos. Que ninguna continuación lleve marcador es lo que
    // impide que la IA lea la segunda línea de un Nodo como un subnodo.
    expect(lines.filter((line) => line.trimStart().startsWith("- "))).toEqual([
      "- Primera",
      "  - Hijo",
    ]);
    expect(lines).toContain("  Segunda");
  });

  it("un árbol vacío es texto vacío", () => {
    expect(serializeTree([])).toBe("");
  });

  it("tiene esta forma exacta", () => {
    // El snapshot no está para descubrir la forma sino para FIJARLA: este texto
    // es la entrada del Proveedor de IA, así que cambiarlo cambia todos los
    // Análisis. Si este test se pone rojo, la pregunta no es «actualízalo», es
    // «¿de verdad queríamos mover el contrato de entrada de la IA?».
    expect(serializeTree(tree())).toMatchInlineSnapshot(`
      "- Tienda online
        - Catálogo
          - Filtros por talla
        - Carrito
      - Fuera de alcance"
    `);
  });
});
