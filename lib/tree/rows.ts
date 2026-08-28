/**
 * El árbol tal y como lo lee la Vista Registro: una lista de filas.
 *
 * `buildTree` da la estructura anidada, que es la verdad del dominio pero no
 * la forma que pinta una lista: una lista necesita saber, por cada fila, a qué
 * profundidad va y —esto es lo que cuesta— qué líneas verticales siguen
 * bajando por su izquierda. Esa segunda pregunta no se puede contestar mirando
 * la fila: depende de si a sus ANTEPASADOS les quedan hermanos por debajo.
 *
 * Está en `lib/tree` y no junto a los componentes por lo mismo que `model.ts`:
 * es geometría del árbol, no de React, y es exactamente el sitio donde un
 * error se ve como «una línea que sobra» sin que nadie sepa por qué. Aquí se
 * puede probar sin montar nada.
 */

import type { TreeNode } from "@/lib/backend/ports";
import {
  buildTree,
  reparentRejection,
  type ReparentRule,
  type Subtree,
} from "@/lib/tree/model";

/** Un Nodo con todo lo que hace falta para pintar su fila y sus botones. */
export type TreeRow = {
  node: TreeNode;
  /** 0 es una raíz. */
  depth: number;
  /**
   * Qué columnas de la izquierda llevan línea vertical. Tiene `depth` entradas.
   *
   * `rails[i]` es la columna `i`, y contesta: ¿el raíl que baja por ahí sigue
   * más allá de esta fila? Para `i < depth - 1` el raíl es el del antepasado
   * que vive a esa profundidad, y sigue si a ese antepasado le quedan hermanos.
   * Para `i === depth - 1` —la columna del codo, la del padre— el raíl es el
   * que lleva a los hermanos de ESTE Nodo, así que sigue si le queda alguno.
   *
   * Una raíz no cuelga de nadie: su lista está vacía.
   */
  rails: boolean[];
  /** Si tiene subnodos: es lo que decide si de su punto sale una bajada. */
  hasChildren: boolean;
  /** Su posición entre sus hermanos. Es lo que apaga «Subir» en el primero. */
  index: number;
  siblingCount: number;
};

/** Lo que hace falta para recorrer el bosque sin recursión. */
type Frame = {
  subtree: Subtree;
  depth: number;
  index: number;
  siblingCount: number;
  /** Los raíles de la fila del PADRE: las columnas `0..depth-2` de esta fila. */
  ancestorRails: boolean[];
};

function framesOf(
  subtrees: Subtree[],
  depth: number,
  ancestorRails: boolean[],
): Frame[] {
  return subtrees.map((subtree, index) => ({
    subtree,
    depth,
    index,
    siblingCount: subtrees.length,
    ancestorRails,
  }));
}

/**
 * El bosque aplanado, en el orden en que se lee: cada Nodo seguido de los suyos.
 *
 * Iterativo y no recursivo, por lo mismo que `countDescendants`: la
 * profundidad no está acotada por nada, y esto además se recorre en cada
 * repintado de la pantalla.
 */
export function treeRows(nodes: TreeNode[]): TreeRow[] {
  const rows: TreeRow[] = [];

  // Pila y no cola: una cola daría el árbol por niveles, y lo que se pinta es
  // cada Nodo con los suyos debajo. Se apila del revés para que el primer
  // hermano sea el primero en salir.
  const pending = framesOf(buildTree(nodes), 0, []).reverse();

  while (pending.length > 0) {
    const frame = pending.pop() as Frame;
    const continues = frame.index < frame.siblingCount - 1;
    // Una raíz no tiene columna del codo, así que tampoco tiene esa entrada.
    const rails = frame.depth === 0 ? [] : [...frame.ancestorRails, continues];

    rows.push({
      node: frame.subtree.node,
      depth: frame.depth,
      rails,
      hasChildren: frame.subtree.children.length > 0,
      index: frame.index,
      siblingCount: frame.siblingCount,
    });

    // Los raíles de esta fila son los del antepasado de sus hijos: la columna
    // del codo de un hijo es justo la del padre.
    const children = framesOf(frame.subtree.children, frame.depth + 1, rails);
    for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
  }

  return rows;
}

/** Un destino posible para un re-parentado, valga o no. */
export type ReparentTarget = {
  node: TreeNode;
  depth: number;
  /** La regla que lo impide, o `null` si se puede colgar ahí. */
  rejection: ReparentRule | null;
  /** Es el padre que ya tiene. No es un fallo: es que no hay nada que mover. */
  current: boolean;
};

/**
 * Todos los Nodos de la Versión como destinos, con su veredicto.
 *
 * Devuelve TAMBIÉN los que no valen, y eso es la decisión de diseño: el
 * selector los enseña bloqueados y con el motivo al lado. Filtrarlos aquí
 * dejaría al usuario buscando un Nodo que desapareció de la lista sin
 * explicación, que es peor que un «no puedes» dicho a la cara.
 *
 * Un Nodo que no está en la Versión no tiene destinos: no hay nada que mover.
 */
export function reparentTargets(
  nodes: TreeNode[],
  nodeId: string,
): ReparentTarget[] {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return [];

  return treeRows(nodes).map((row) => ({
    node: row.node,
    depth: row.depth,
    rejection: reparentRejection(nodes, nodeId, row.node.id),
    current: row.node.id === node.parentId,
  }));
}

/**
 * Las filas de un Nodo y de todo lo que cuelga de él, en orden de lectura.
 *
 * Es lo que se va por delante al borrar, y por eso existe: la confirmación no
 * solo dice CUÁNTOS caen —eso lo cuenta `countDescendants`—, también los
 * enseña, y para enseñarlos hace falta su profundidad para sangrarlos.
 *
 * Se resuelve sobre la lista ya aplanada y no recorriendo el árbol otra vez:
 * en una lista en orden de lectura, el subárbol de un Nodo es exactamente el
 * tramo que va detrás de él hasta el primero que no es más profundo. Esa
 * propiedad es la que hace que sangrar y contar coincidan siempre.
 */
export function subtreeRows(nodes: TreeNode[], nodeId: string): TreeRow[] {
  const rows = treeRows(nodes);
  const start = rows.findIndex((row) => row.node.id === nodeId);
  if (start === -1) return [];

  const root = rows[start];
  let end = start + 1;
  while (end < rows.length && rows[end].depth > root.depth) end += 1;
  return rows.slice(start, end);
}
