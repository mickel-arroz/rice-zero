/**
 * La Limpieza: qué se borra de la Versión abierta, y cuánto.
 *
 * La regla y sus razones están en el ADR 0007. Lo que importa al leer esto:
 * la Limpieza NO sigue al Subárbol completado del ADR 0004. Lo tachado se
 * hereda; lo borrable no. Un Nodo solo es borrable si él y todos sus
 * descendientes tienen su PROPIA marca de completado. No «unificar» con
 * `serialize`: la divergencia es deliberada, porque borrar no se deshace.
 *
 * Una sola función decide qué se borra y cuenta cuánto, para que la cifra del
 * diálogo y lo borrado no puedan discrepar.
 */

import type { TreeNode } from "@/lib/backend/ports";
import { childrenByParent } from "@/lib/tree/model";

export type CleanupPlan = {
  /**
   * Las raíces de subárbol a borrar: los borrables cuyo padre no lo es.
   * Solo ellas, porque la cascada del motor se lleva el resto.
   */
  roots: string[];
  /** Cuántos Nodos desaparecen en total, raíces incluidas. */
  total: number;
};

export function cleanupPlan(nodes: TreeNode[]): CleanupPlan {
  const childrenOf = childrenByParent(nodes);

  // Preorden iterativo, como `countDescendants`: la profundidad no está
  // acotada. Recorrido al revés, cada hijo se decide antes que su padre.
  const preorder: TreeNode[] = [];
  const pending = [...(childrenOf.get(null) ?? [])].reverse();
  while (pending.length > 0) {
    const node = pending.pop() as TreeNode;
    preorder.push(node);
    pending.push(...[...(childrenOf.get(node.id) ?? [])].reverse());
  }

  // Un Nodo que el recorrido no alcanza —un padre que no está en la lista, que
  // con la FK no debería pasar— no se marca nunca: ante la duda, se conserva.
  // Con lo irreversible, el error tiene que caer de ese lado.
  const deletable = new Set<string>();
  for (const node of [...preorder].reverse()) {
    const children = childrenOf.get(node.id) ?? [];
    if (node.completed && children.every((child) => deletable.has(child.id))) {
      deletable.add(node.id);
    }
  }

  const roots = preorder
    .filter((node) => deletable.has(node.id))
    .filter((node) => node.parentId == null || !deletable.has(node.parentId))
    .map((node) => node.id);

  // Todo descendiente de una raíz del plan es borrable por construcción, así
  // que contar los borrables ES contar lo que la cascada se lleva.
  return { roots, total: deletable.size };
}
