/**
 * La forma de la Propuesta de Nodos, afirmada.
 *
 * Los tres topes son el glosario dicho en código (`CONTEXT.md` → Propuesta de
 * Nodos): hasta 5 raíces, 25 Nodos y 3 niveles. Lo que se prueba es el borde
 * exacto de cada uno —el último que entra y el primero que no—, porque un tope
 * desplazado en uno es justo el fallo que un test genérico no ve.
 */

import { describe, expect, it } from "vitest";

import { proposalSchema, type Proposal } from "@/lib/ai/proposal";

/** `n` raíces sin hijos. */
function roots(n: number): Proposal["roots"] {
  return Array.from({ length: n }, (_, i) => ({ text: `Raíz ${i + 1}`, children: [] }));
}

/**
 * Una raíz con `n` hijos sin nietos: 1 + n Nodos.
 */
function rootWith(n: number): Proposal["roots"][number] {
  return {
    text: "Raíz",
    children: Array.from({ length: n }, (_, i) => ({ text: `Hijo ${i + 1}`, children: [] })),
  };
}

function accepts(proposal: unknown): boolean {
  return proposalSchema.safeParse(proposal).success;
}

describe("el schema de la Propuesta de Nodos", () => {
  it("acepta una Propuesta de tres niveles", () => {
    expect(
      accepts({
        roots: [
          {
            text: "Menú semanal",
            children: [{ text: "Repetir la semana", children: [{ text: "Avisar si se repite" }] }],
          },
        ],
      }),
    ).toBe(true);
  });

  it("pide al menos una raíz", () => {
    expect(accepts({ roots: [] })).toBe(false);
  });

  it("acepta 5 raíces y rechaza 6", () => {
    expect(accepts({ roots: roots(5) })).toBe(true);
    expect(accepts({ roots: roots(6) })).toBe(false);
  });

  it("acepta 25 Nodos y rechaza 26", () => {
    // 1 + 24 = 25 y 1 + 25 = 26, contando la raíz.
    expect(accepts({ roots: [rootWith(24)] })).toBe(true);
    expect(accepts({ roots: [rootWith(25)] })).toBe(false);
  });

  it("cuenta los Nodos de todas las raíces juntas", () => {
    // 5 raíces de 5 Nodos = 25; una más en cualquiera, 26.
    const full = Array.from({ length: 5 }, () => rootWith(4));
    expect(accepts({ roots: full })).toBe(true);
    full[4].children[0].children = [{ text: "Uno de más" }];
    expect(accepts({ roots: full })).toBe(false);
  });

  it("rechaza un cuarto nivel", () => {
    expect(
      accepts({
        roots: [
          {
            text: "1",
            children: [{ text: "2", children: [{ text: "3", children: [{ text: "4" }] }] }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("rechaza un Nodo sin texto", () => {
    expect(accepts({ roots: [{ text: "  ", children: [] }] })).toBe(false);
  });
});
