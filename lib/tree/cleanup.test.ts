/**
 * El plan de Limpieza: qué se borra y cuánto.
 *
 * Los casos son los que el ADR 0007 obliga a cubrir. Lo que se afirma es lo
 * que se ve desde fuera —qué Nodos desaparecen de la Versión y qué cifra se
 * enseña— y no cómo los recorre la función.
 */

import { describe, expect, it } from "vitest";

import type { TreeNode } from "@/lib/backend/ports";
import { cleanupPlan } from "@/lib/tree/cleanup";
import { countDescendants } from "@/lib/tree/model";
import { treeNode } from "@/lib/tree/testing";

/** Marca como completados, por su propia marca, los ids dados. */
function complete(nodes: TreeNode[], ...ids: string[]): TreeNode[] {
  return nodes.map((node) =>
    ids.includes(node.id) ? { ...node, completed: true } : node,
  );
}

/** Lo que el motor deja tras borrar las raíces del plan (cascada incluida). */
function afterCleanup(nodes: TreeNode[]): string[] {
  const gone = new Set<string>();
  const pending = [...cleanupPlan(nodes).roots];
  while (pending.length > 0) {
    const id = pending.pop() as string;
    gone.add(id);
    for (const node of nodes) if (node.parentId === id) pending.push(node.id);
  }
  return nodes.filter((node) => !gone.has(node.id)).map((node) => node.id);
}

// El caso del ADR:
//   tienda
//     catalogo         ← completado
//       filtros        ← pendiente
//       fichas         ← completado
//         fotos        ← completado
//     carrito
//   blog               ← completado
//     portada          ← completado
const TREE = [
  treeNode("tienda", null, 0),
  treeNode("catalogo", "tienda", 0),
  treeNode("filtros", "catalogo", 0),
  treeNode("fichas", "catalogo", 1),
  treeNode("fotos", "fichas", 0),
  treeNode("carrito", "tienda", 1),
  treeNode("blog", null, 1),
  treeNode("portada", "blog", 0),
];

describe("el plan de Limpieza", () => {
  it("un completado con un hijo pendiente se conserva, y el pendiente con él", () => {
    const nodes = complete(TREE, "catalogo");
    const left = afterCleanup(nodes);
    expect(left).toContain("catalogo");
    expect(left).toContain("filtros");
  });

  it("un descendiente pendiente más abajo también lo conserva", () => {
    // Pendiente a dos niveles: el abuelo completado tampoco es borrable.
    const nodes = complete(TREE, "tienda", "catalogo", "fichas", "fotos", "carrito");
    expect(afterCleanup(nodes)).toEqual(
      expect.arrayContaining(["tienda", "catalogo", "filtros"]),
    );
  });

  it("bajo un padre conservado, un hijo enteramente completado se borra", () => {
    const nodes = complete(TREE, "catalogo", "fichas", "fotos");
    const left = afterCleanup(nodes);
    expect(left).not.toContain("fichas");
    expect(left).not.toContain("fotos");
    expect(left).toContain("catalogo");
  });

  it("manda borrar la raíz del subárbol, no a sus descendientes uno a uno", () => {
    // La cascada se lleva a «fotos»: nombrarlo sería una segunda escritura
    // sobre un Nodo que ya no existe.
    const nodes = complete(TREE, "catalogo", "fichas", "fotos");
    expect(cleanupPlan(nodes).roots).toEqual(["fichas"]);
  });

  it("una raíz enteramente completada se borra", () => {
    const nodes = complete(TREE, "blog", "portada");
    expect(afterCleanup(nodes)).not.toContain("blog");
  });

  it("con todo completado, la Versión queda vacía", () => {
    const nodes = complete(TREE, ...TREE.map((n) => n.id));
    expect(afterCleanup(nodes)).toEqual([]);
  });

  it("lo tachado por herencia no cuenta: hace falta la marca propia", () => {
    // «portada» se pinta tachado bajo «blog», pero su marca sigue en falso.
    const nodes = complete(TREE, "blog");
    expect(afterCleanup(nodes)).toEqual(TREE.map((n) => n.id));
  });

  it("sin nada completado, el plan está vacío", () => {
    expect(cleanupPlan(TREE)).toEqual({ roots: [], total: 0 });
  });

  it("una Versión sin Nodos da un plan vacío", () => {
    expect(cleanupPlan([])).toEqual({ roots: [], total: 0 });
  });

  it.each([
    ["solo una hoja", ["fotos"]],
    ["un subárbol bajo un padre conservado", ["catalogo", "fichas", "fotos"]],
    ["una raíz entera", ["blog", "portada"]],
    ["todo", TREE.map((n) => n.id)],
  ])("la cifra es exactamente lo que se borra: %s", (_caso, ids) => {
    const nodes = complete(TREE, ...ids);
    const plan = cleanupPlan(nodes);
    expect(plan.total).toBe(nodes.length - afterCleanup(nodes).length);
    // Y es la misma cuenta que daría podar cada raíz a mano.
    expect(plan.total).toBe(
      plan.roots.reduce((sum, id) => sum + 1 + countDescendants(nodes, id), 0),
    );
  });
});
