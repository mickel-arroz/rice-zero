/**
 * El dominio del árbol: las reglas, sin I/O.
 *
 * Entra siempre una lista PLANA de Nodos —la forma exacta que devuelve
 * `nodes.listByVersion`— y sale estructura o un plan de escritura. Nada de
 * aquí conoce el Proveedor de Backend, y esa es la razón de que exista: las
 * reglas del árbol son las mismas se persistan donde se persistan, y son el
 * sitio del proyecto con más bugs por línea posible.
 *
 * El motor solo ataja el ciclo degenerado (`nodes_not_own_parent`). Los ciclos
 * largos —mover un Nodo bajo un descendiente suyo— se impiden aquí.
 */

import type { TreeNode } from "@/lib/backend/ports";

/**
 * Un Nodo con los suyos colgando.
 *
 * Se llama `Subtree` y no `Branch` porque `CONTEXT.md` reserva «rama» como
 * término a evitar para Versión: dos cosas distintas no pueden compartir
 * palabra. «Subárbol» ya es el término que usa el spec al hablar de podar.
 */
export type Subtree = {
  node: TreeNode;
  children: Subtree[];
};

/**
 * Ordena hermanos: por `orderIndex`, y el id desempata.
 *
 * El desempate no es decorativo. `order_index` tiene `default 0`, así que dos
 * hermanos pueden compartirlo de verdad —los crea la misma pantalla, o los
 * dejó así una versión anterior—, y sin criterio estable el árbol saldría en
 * un orden distinto en cada lectura. El árbol serializado alimenta a la IA:
 * un orden inestable sería un Análisis distinto para el mismo árbol.
 */
function bySiblingOrder(a: TreeNode, b: TreeNode): number {
  if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Construye el bosque de una Versión: las raíces, con todo colgando.
 *
 * Bosque y no árbol: una Versión admite VARIAS raíces (`parent_id` es
 * nullable), porque volcar ideas sueltas antes de conectarlas es el primer
 * paso del flujo y no una anomalía.
 */
export function buildTree(nodes: TreeNode[]): Subtree[] {
  const subtrees = new Map<string, Subtree>();
  for (const node of nodes) subtrees.set(node.id, { node, children: [] });

  const roots: Subtree[] = [];
  for (const node of [...nodes].sort(bySiblingOrder)) {
    const subtree = subtrees.get(node.id) as Subtree;
    // Un padre que no está en la lista cuenta como raíz. Con la FK puesta no
    // debería pasar nunca; si pasara, el Nodo aparece suelto en vez de
    // desaparecer del árbol sin que nadie se entere.
    const parent = node.parentId == null ? undefined : subtrees.get(node.parentId);
    if (parent) parent.children.push(subtree);
    else roots.push(subtree);
  }

  return roots;
}

/**
 * Un índice por id, para no recorrer la lista una vez por pregunta.
 *
 * Privado a propósito: quien llama trae la lista plana que ya tenía y no un
 * índice que habría que construir, pasar y mantener fresco.
 */
function indexById(nodes: TreeNode[]): Map<string, TreeNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

/**
 * Los hijos de cada padre, ya ordenados. `null` agrupa a las raíces.
 *
 * Uno solo para todo el módulo. Antes había tres formas distintas de
 * preguntar «¿quiénes cuelgan de X?» —una por función—, y tres formas de
 * agrupar son tres sitios donde el orden de los hermanos puede divergir sin
 * que ningún test lo note.
 */
function childrenByParent(nodes: TreeNode[]): Map<string | null, TreeNode[]> {
  const children = new Map<string | null, TreeNode[]>();
  for (const node of [...nodes].sort(bySiblingOrder)) {
    const siblings = children.get(node.parentId);
    if (siblings) siblings.push(node);
    else children.set(node.parentId, [node]);
  }
  return children;
}

/**
 * Cuántos Nodos se van con él si se borra: el subárbol, sin contarlo a él.
 *
 * Es la cifra de la confirmación de borrado que pide el spec («indicando
 * cuántos descendientes caen»), y vive aquí porque contarla es recorrer el
 * árbol, no consultar el backend: el motor ya cascadea solo.
 */
export function countDescendants(nodes: TreeNode[], nodeId: string): number {
  const childrenOf = childrenByParent(nodes);

  // Iterativo y no recursivo: el árbol lo escribe un humano a mano, pero la
  // profundidad no está acotada por nada y un desbordamiento de pila al
  // CONTAR sería un fallo absurdo.
  let total = 0;
  const pending = [nodeId];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const child of childrenOf.get(current) ?? []) {
      total += 1;
      pending.push(child.id);
    }
  }
  return total;
}

/** Las reglas que puede violar un re-parentado. Frases cortas y estables. */
export const REPARENT_RULES = {
  cycle: "ciclo",
  unknownNode: "nodo-desconocido",
  unknownParent: "padre-desconocido",
} as const;

export type ReparentRule = (typeof REPARENT_RULES)[keyof typeof REPARENT_RULES];

/**
 * ¿Se puede colgar `nodeId` de `parentId`? La regla que lo impide, o `null`.
 *
 * Devuelve la regla y no una frase: el texto que ve el usuario vive en la capa
 * de servicios, junto al resto de la copia en español (ver `NODE_ERRORS`).
 * Un módulo de dominio que hablara español ya no serviría para dos interfaces.
 *
 * Y devuelve en vez de lanzar porque la interfaz también pregunta SIN intención
 * de mover: el Canvas necesita saber, mientras se arrastra, si el destino bajo
 * el cursor vale, y una excepción por fotograma sería usar el mecanismo de los
 * fallos para dibujar. Quien lanza es el servicio.
 *
 * `parentId` a `null` significa «déjalo como raíz», que siempre vale: una
 * Versión admite varias raíces.
 */
export function reparentRejection(
  nodes: TreeNode[],
  nodeId: string,
  parentId: string | null,
): ReparentRule | null {
  const byId = indexById(nodes);
  if (!byId.has(nodeId)) return REPARENT_RULES.unknownNode;
  if (parentId === null) return null;
  if (!byId.has(parentId)) return REPARENT_RULES.unknownParent;

  // Se sube desde el destino hasta la raíz: si se pasa por el Nodo que se
  // mueve, colgarlo ahí cerraría el ciclo. Se sube y no se baja porque el
  // camino hacia la raíz es una lista, no un árbol — y el caso degenerado
  // (`parentId === nodeId`) cae en el mismo recorrido, en la primera vuelta.
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor !== null) {
    if (cursor === nodeId) return REPARENT_RULES.cycle;
    // Un ciclo YA persistido colgaría el bucle. No debería existir —el motor y
    // esta misma función lo impiden—, pero rendirse es mejor que no volver.
    if (seen.has(cursor)) break;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId ?? null;
  }

  return null;
}

/**
 * Los hermanos de un padre —o las raíces, con `null`—, ya en orden.
 *
 * Sin exportar: hoy solo lo usan `nextOrderIndex` y `reorderPlan`, y una
 * función pública que nadie importa es superficie que hay que sostener a
 * cambio de nada. El día que la Vista Registro la necesite, se exporta.
 */
function siblingsOf(nodes: TreeNode[], parentId: string | null): TreeNode[] {
  return childrenByParent(nodes).get(parentId) ?? [];
}

/**
 * El `orderIndex` que le toca a un Nodo nuevo bajo ese padre: el último.
 *
 * Es `hermanos.length` y no `máximo + 1` porque el plan de reordenado deja
 * siempre los índices densos: mientras nadie escriba a mano, las dos cuentas
 * dan lo mismo, y ésta no se va a las nubes si alguna vez no fuera así.
 */
export function nextOrderIndex(nodes: TreeNode[], parentId: string | null): number {
  return siblingsOf(nodes, parentId).length;
}

/**
 * En qué puesto está un Nodo entre sus hermanos, o `-1` si no está en la lista.
 *
 * Es el sitio REAL, contado sobre el árbol ya ordenado, y no su `orderIndex`
 * guardado: los índices admiten huecos —`reparent` deja uno cada vez que se
 * lleva un Nodo— y quien pregunta esto quiere el puesto que ve el usuario.
 *
 * Existe para «crear hermano»: el Nodo nuevo nace el último de la lista y hay
 * que traerlo justo detrás de la referencia, así que hace falta saber dónde
 * estaba ella. La Vista Registro lo lee de `outlineRows`, que ya lo trae.
 */
export function siblingIndexOf(nodes: TreeNode[], nodeId: string): number {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return -1;
  return siblingsOf(nodes, node.parentId).findIndex(
    (sibling) => sibling.id === nodeId,
  );
}

/** Un `orderIndex` nuevo para un Nodo: lo que hay que escribir, y nada más. */
export type OrderWrite = {
  id: string;
  orderIndex: number;
};

/**
 * Qué escribir para dejar `nodeId` en la posición `toIndex` de sus hermanos.
 *
 * Devuelve el PLAN y no lo aplica: el módulo es puro, y separar «qué habría
 * que escribir» de «escríbelo» es lo que permite comprobar el orden sin
 * backend y, de paso, no gastar un viaje al motor por cada hermano que no se
 * mueve — el plan solo trae los que cambian de verdad.
 *
 * Los índices quedan densos (0..n-1). El destino se recorta al rango en vez de
 * rechazarse: quien llama es un arrastre o un botón «subir» al final de la
 * lista, y ahí «tan arriba como se pueda» es la intención, no un error.
 */
export function reorderPlan(
  nodes: TreeNode[],
  nodeId: string,
  toIndex: number,
): OrderWrite[] {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return [];

  const siblings = siblingsOf(nodes, node.parentId);
  const from = siblings.findIndex((sibling) => sibling.id === nodeId);
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), siblings.length - 1);

  const ordered = [...siblings];
  ordered.splice(to, 0, ...ordered.splice(from, 1));

  const plan: OrderWrite[] = [];
  ordered.forEach((sibling, index) => {
    // Solo entra en el plan quien acabaría con un `orderIndex` distinto del
    // que ya tiene guardado — se haya movido o no.
    if (sibling.orderIndex !== index) plan.push({ id: sibling.id, orderIndex: index });
  });
  return plan;
}
