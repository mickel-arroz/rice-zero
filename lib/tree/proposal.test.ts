/**
 * La Propuesta de Nodos, convertida en las creaciones que la meten en el árbol.
 *
 * Lo que se afirma son las promesas del glosario y no un orden concreto: todo
 * entra, las raíces quedan en el orden propuesto y al final, cada Nodo cuelga
 * de su padre propuesto, y nada cuelga de un Nodo que ya existía.
 */

import { describe, expect, it } from "vitest";

import { countProposalNodes, type Proposal } from "@/lib/ai/proposal";
import { proposalCreations, type NodeCreation } from "@/lib/tree/proposal";

const PROPOSAL: Proposal = {
  roots: [
    {
      text: "Menú semanal",
      children: [
        { text: "Un día por receta", children: [] },
        { text: "Repetir la semana", children: [{ text: "Avisar si se repite" }] },
      ],
    },
    { text: "Lista de la compra", children: [{ text: "Sumar cantidades", children: [] }] },
    { text: "Compartir", children: [] },
  ],
};

/** El texto del padre de cada creación, o `null` si es raíz. */
function parentTextOf(creations: NodeCreation[]): Map<string, string | null> {
  const byKey = new Map(creations.map((c) => [c.key, c]));
  return new Map(
    creations.map((c) => [
      c.content,
      c.parentKey === null ? null : (byKey.get(c.parentKey)?.content ?? "¿?"),
    ]),
  );
}

describe("la Propuesta, en creaciones de Nodos", () => {
  const creations = proposalCreations(PROPOSAL);

  it("crea todos los Nodos de la Propuesta, ni uno más", () => {
    expect(creations).toHaveLength(countProposalNodes(PROPOSAL));
  });

  it("las raíces nuevas salen en el orden propuesto", () => {
    expect(creations.filter((c) => c.parentKey === null).map((c) => c.content)).toEqual([
      "Menú semanal",
      "Lista de la compra",
      "Compartir",
    ]);
  });

  it("cada Nodo cuelga del padre que proponía la IA", () => {
    expect(Object.fromEntries(parentTextOf(creations))).toEqual({
      "Menú semanal": null,
      "Un día por receta": "Menú semanal",
      "Repetir la semana": "Menú semanal",
      "Avisar si se repite": "Repetir la semana",
      "Lista de la compra": null,
      "Sumar cantidades": "Lista de la compra",
      Compartir: null,
    });
  });

  /**
   * «Ningún Nodo existente cambia», dicho desde la estructura: si todo padre
   * es una creación ANTERIOR del mismo plan, ninguna puede colgar de un Nodo
   * del árbol ni moverlo. Y que el padre vaya antes es además lo que permite
   * ejecutar el plan en orden, sabiendo ya su id real.
   */
  it("todo padre es una creación anterior del mismo plan, nunca un Nodo existente", () => {
    const seen = new Set<string>();
    for (const creation of creations) {
      if (creation.parentKey !== null) expect(seen.has(creation.parentKey)).toBe(true);
      seen.add(creation.key);
    }
  });

  it("las claves no se repiten", () => {
    expect(new Set(creations.map((c) => c.key)).size).toBe(creations.length);
  });

  it("los hermanos salen en el orden propuesto", () => {
    const children = creations.filter((c) => parentTextOf(creations).get(c.content) === "Menú semanal");
    expect(children.map((c) => c.content)).toEqual(["Un día por receta", "Repetir la semana"]);
  });
});
