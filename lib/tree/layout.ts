/**
 * Dónde va cada Nodo en el lienzo. Geometría, sin React y sin backend.
 *
 * Es a la Vista Canvas lo que `rows.ts` es a la Vista Registro: la misma
 * entrada —la lista PLANA que devuelve `nodes.listByVersion`— y otra forma de
 * salida. Y vive aquí por lo mismo que aquél: colocar un árbol es el sitio
 * donde un error se ve como «un Nodo encima de otro» sin que nadie sepa por
 * qué, y aquí se puede probar sin montar un lienzo.
 *
 * El sentido es LR —la profundidad crece a la derecha y los hermanos bajan—
 * porque es la sangría de la Vista Registro girada 90°: el mismo árbol tiene
 * que leerse igual en las dos vistas.
 *
 * ── El reparto con dagre ──────────────────────────────────────────────────
 *
 * `@dagrejs/dagre` coloca el EJE DE LA PROFUNDIDAD: en qué columna cae cada
 * nivel teniendo en cuenta lo ancho que es el Nodo más ancho de cada uno. Es
 * síncrono, así que estos tests corren sin worker ni navegador.
 *
 * El eje de los hermanos lo calcula este módulo, y no es capricho: dagre
 * ordena cada nivel para minimizar CRUCES, que es el objetivo correcto para un
 * grafo y el equivocado para un árbol. Con el bosque de `layout.test.ts` metía
 * `b` por encima de `a` aun estando `a` primero — y la barra de acciones es la
 * misma en las dos vistas, así que «Subir» habría movido el Nodo en una
 * dirección que no es la que se ve. Aquí los hermanos van en el orden del
 * árbol y cada padre se centra sobre los suyos, que es lo que hace que un
 * árbol se lea como un árbol.
 *
 * Y el BOSQUE tampoco es de dagre: una Versión admite varias raíces, y dagre
 * trataría cada árbol como un componente desconectado y los empaquetaría como
 * quepan. Aquí cada raíz se coloca por separado y las bandas se apilan en el
 * orden de las raíces: un bosque son ideas sueltas que se leen de arriba
 * abajo, no un grafo al que le sobra sitio.
 */

import dagre from "@dagrejs/dagre";

import type { TreeNode } from "@/lib/backend/ports";
import { buildTree, type Subtree } from "@/lib/tree/model";

/** Lo que ocupa un Nodo. Lo mide quien lo pinta; aquí solo se coloca. */
export type NodeSize = {
  width: number;
  height: number;
};

/** Un Nodo ya colocado. `x`/`y` son la esquina superior izquierda. */
export type NodeBox = NodeSize & {
  id: string;
  x: number;
  y: number;
};

/** El bosque colocado y lo que ocupa entero. */
export type ForestLayout = {
  boxes: NodeBox[];
  width: number;
  height: number;
};

/**
 * El aire del dibujo, en píxeles.
 *
 * Son tres y no uno porque separan cosas distintas: `rank` es la distancia de
 * lectura entre un Nodo y sus subnodos, `sibling` la que deja claro que dos
 * Nodos son hermanos, y `root` la que dice «esto ya es otra idea». Si `root`
 * no fuera bastante mayor que `sibling`, dos raíces se leerían como hermanas.
 */
export const LAYOUT_GAPS = {
  rank: 72,
  sibling: 24,
  root: 48,
} as const;

export type LayoutGaps = typeof LAYOUT_GAPS;

/** Cuánto mide cada Nodo. Lo decide quien lo pinta: el alto sale del texto. */
export type Measure = (node: TreeNode) => NodeSize;

/**
 * Los Nodos de un subárbol en orden de lectura: cada uno seguido de los suyos.
 *
 * Iterativo por lo mismo que `countDescendants` y `treeRows`: la profundidad
 * no está acotada por nada, y un desbordamiento de pila al DIBUJAR sería un
 * fallo absurdo.
 */
function readingOrder(root: Subtree): TreeNode[] {
  const ordered: TreeNode[] = [];
  const pending: Subtree[] = [root];

  while (pending.length > 0) {
    const current = pending.pop() as Subtree;
    ordered.push(current.node);
    // Del revés, para que el primer hermano sea el primero en salir.
    for (let i = current.children.length - 1; i >= 0; i--) {
      pending.push(current.children[i]);
    }
  }

  return ordered;
}

/** Dónde acabó un subárbol: el Nodo, y la franja que ocupa con los suyos. */
type Placement = {
  /** El borde de arriba del Nodo. */
  top: number;
  /** La franja del subárbol ENTERO, que puede sobresalir del Nodo. */
  bandTop: number;
  bandBottom: number;
};

/**
 * A qué altura va cada Nodo: los hermanos en el orden del árbol, cada padre
 * centrado sobre los suyos.
 *
 * Recorre en post-orden —hay que colocar a los hijos para saber dónde va el
 * padre— con una pila explícita y no con recursión, por lo mismo de siempre.
 *
 * La franja de un subárbol empieza donde se le dijo y acaba en lo más bajo de
 * él, padre incluido: un padre más alto que sus hijos SOBRESALE por abajo, y
 * si la franja no lo contase, el hermano siguiente se le echaría encima.
 */
function stackByTreeOrder(
  root: Subtree,
  measure: Measure,
  gap: number,
): Map<string, number> {
  const tops = new Map<string, number>();

  type Frame = {
    subtree: Subtree;
    /** Desde dónde puede empezar a ocupar este subárbol. */
    top: number;
    /** El siguiente hijo por visitar. */
    next: number;
    /** Lo que ya devolvieron los hijos visitados, en orden. */
    kids: Placement[];
  };

  const stack: Frame[] = [{ subtree: root, top: 0, next: 0, kids: [] }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    // Todavía le quedan hijos: se baja a por el siguiente, que arranca justo
    // debajo de la franja del anterior.
    if (frame.next < frame.subtree.children.length) {
      const child = frame.subtree.children[frame.next];
      frame.next += 1;
      const previous = frame.kids[frame.kids.length - 1];
      stack.push({
        subtree: child,
        top: previous ? previous.bandBottom + gap : frame.top,
        next: 0,
        kids: [],
      });
      continue;
    }

    stack.pop();
    const height = measure(frame.subtree.node).height;

    let placement: Placement;
    if (frame.kids.length === 0) {
      placement = {
        top: frame.top,
        bandTop: frame.top,
        bandBottom: frame.top + height,
      };
    } else {
      const first = frame.kids[0];
      const last = frame.kids[frame.kids.length - 1];
      const lastNode = frame.subtree.children[frame.kids.length - 1].node;
      // Centrado entre el borde de ARRIBA del primer hijo y el de ABAJO del
      // último: es la línea que el ojo lee como «de aquí cuelgan éstos».
      const centre = (first.top + last.top + measure(lastNode).height) / 2;
      // Y nunca por encima de donde empieza su franja. Un padre MÁS ALTO que
      // lo que ocupan los suyos —tres líneas colgando de una, que es texto
      // largo con un subnodo corto— se centraría por encima de su propio
      // techo, y ese techo es el suelo del hermano de arriba. Recortar aquí
      // es lo que sostiene la invariante «ningún Nodo se pisa»; antes la
      // sostenían los números concretos del dibujo, que no es una invariante.
      const top = Math.max(frame.top, centre - height / 2);
      placement = {
        top,
        bandTop: frame.top,
        bandBottom: Math.max(last.bandBottom, top + height),
      };
    }

    tops.set(frame.subtree.node.id, placement.top);
    const parent = stack[stack.length - 1];
    if (parent) parent.kids.push(placement);
  }

  return tops;
}

/**
 * Coloca un árbol —una raíz con todo lo suyo— y lo lleva al origen.
 *
 * Sale con la esquina en (0,0) para que apilar bandas sea sumar: quien apila
 * no tiene que saber dónde había decidido dagre empezar a dibujar.
 */
function layoutBand(
  root: Subtree,
  measure: Measure,
  gaps: LayoutGaps,
): ForestLayout {
  const nodes = readingOrder(root);

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "LR",
    ranksep: gaps.rank,
    nodesep: gaps.sibling,
    marginx: 0,
    marginy: 0,
  });
  // dagre pide etiqueta en cada arista aunque no se use ninguna.
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(nodes.map((node) => node.id));
  for (const node of nodes) graph.setNode(node.id, measure(node));
  for (const node of nodes) {
    if (node.parentId !== null && known.has(node.parentId)) {
      graph.setEdge(node.parentId, node.id);
    }
  }

  dagre.layout(graph);

  const tops = stackByTreeOrder(root, measure, gaps.sibling);

  // De dagre se toma la columna y nada más; la altura la puso `stackByTreeOrder`.
  // dagre devuelve el CENTRO de cada caja y el lienzo posiciona por la esquina.
  const placed = nodes.map((node) => {
    const { x, width, height } = graph.node(node.id);
    return {
      id: node.id,
      x: x - width / 2,
      y: tops.get(node.id) as number,
      width,
      height,
    };
  });

  const left = Math.min(...placed.map((box) => box.x));
  const top = Math.min(...placed.map((box) => box.y));

  // Se redondea AQUÍ y no al pintar: centrar un padre entre un número par de
  // hijos deja medios píxeles, y un lienzo con coordenadas fraccionarias
  // dibuja bordes borrosos. Redondear al final deja además el resultado
  // comparable en un test sin tolerancias.
  const boxes = placed.map((box) => ({
    ...box,
    x: Math.round(box.x - left),
    y: Math.round(box.y - top),
  }));

  return {
    boxes,
    width: Math.max(...boxes.map((box) => box.x + box.width)),
    height: Math.max(...boxes.map((box) => box.y + box.height)),
  };
}

/**
 * El bosque de una Versión, colocado: una banda por raíz, apiladas.
 *
 * @param measure cuánto mide cada Nodo. Lo decide quien lo pinta: el alto sale
 *   del texto, y el texto no lo conoce este módulo.
 */
export function layoutForest(
  nodes: TreeNode[],
  measure: Measure,
): ForestLayout {
  if (nodes.length === 0) return { boxes: [], width: 0, height: 0 };

  const roots = buildTree(nodes);

  // Lo que no cuelga de ninguna raíz. Con las claves ajenas puestas no debería
  // existir —haría falta un ciclo ya persistido—, y aun así se coloca: un Nodo
  // que desaparece del lienzo sin explicación es peor que uno suelto al final.
  const placed = new Set(roots.flatMap(readingOrder).map((node) => node.id));
  for (const node of nodes) {
    if (!placed.has(node.id)) roots.push({ node, children: [] });
  }

  const boxes: NodeBox[] = [];
  let offset = 0;
  let width = 0;

  for (const root of roots) {
    const band = layoutBand(root, measure, LAYOUT_GAPS);
    for (const box of band.boxes) boxes.push({ ...box, y: box.y + offset });
    width = Math.max(width, band.width);
    offset += band.height + LAYOUT_GAPS.root;
  }

  return {
    boxes,
    width,
    // El último `root` sobra: se sumó al salir de la banda de abajo y no separa
    // de nada. Restarlo es lo que hace que la envolvente sea la envolvente.
    height: offset - LAYOUT_GAPS.root,
  };
}

/** Un enlace del lienzo: de padre a hijo. */
export type TreeEdge = {
  id: string;
  source: string;
  target: string;
};

/**
 * Los enlaces que hay que dibujar: uno por Nodo que cuelga de otro.
 *
 * Se salta a los que apuntan a un padre que no está en la lista. No es
 * defensivo por deporte: `layoutForest` coloca a ese Nodo como raíz, y un
 * enlace hacia un Nodo que no está en el lienzo es lo que hace que el lienzo
 * se queje —o peor, que dibuje una línea hacia la nada.
 */
export function treeEdges(nodes: TreeNode[]): TreeEdge[] {
  const known = new Set(nodes.map((node) => node.id));

  return nodes
    .filter((node) => node.parentId !== null && known.has(node.parentId))
    .map((node) => ({
      id: `${node.parentId}->${node.id}`,
      source: node.parentId as string,
      target: node.id,
    }));
}
