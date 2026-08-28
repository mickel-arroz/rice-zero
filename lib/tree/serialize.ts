/**
 * El árbol de una Versión, a texto plano para la IA.
 *
 * Es la ENTRADA del Proveedor de IA (`CONTEXT.md` → Análisis: «texto
 * serializado del árbol»), y por eso el requisito de fondo es que sea
 * DETERMINISTA: el mismo árbol tiene que dar exactamente el mismo texto
 * siempre, venga la lista de filas en el orden que venga. Si no, dos
 * Análisis del mismo árbol saldrían distintos y nadie sabría por qué.
 *
 * El determinismo lo garantiza `buildTree`, que ordena hermanos por
 * `orderIndex` con el id de desempate. Aquí solo se recorre y se pinta.
 */

import type { TreeNode } from "@/lib/backend/ports";
import { buildTree, type Subtree } from "@/lib/tree/model";

/** Lo que se pinta cuando un Nodo está creado pero todavía vacío. */
export const EMPTY_NODE_PLACEHOLDER = "(sin texto)";

/**
 * Lo que separa un nivel del siguiente. Dos espacios: bastan y no gritan.
 *
 * Sin exportar, a diferencia del marcador de Nodo vacío: ese lo comprueba un
 * test, éste no lo necesita nadie fuera de aquí.
 */
const INDENT = "  ";

/**
 * Las líneas de UN Nodo: la suya y las que le sobren si su texto es de varias.
 *
 * Es una función aparte y no un `lines.push()` dentro del recorrido porque un
 * Nodo no rinde siempre una línea: `content` es texto libre, y el usuario
 * puede meter saltos dentro de un mismo Nodo.
 */
function renderNode(content: string, depth: number): string[] {
  const text = content.trim() || EMPTY_NODE_PLACEHOLDER;
  const [first, ...rest] = text.split("\n");

  // Marcador `- ` y no sangría pelada: al modelo hay que decirle dónde empieza
  // una idea y dónde sigue la anterior, y dos espacios de más no se lo dicen.
  // Las continuaciones van a `depth + 1` SIN marcador: más adentro que su
  // propia línea —para que se lean como suyas— pero sin fingir que son Nodos.
  // Que caigan a la misma altura que los hijos es aceptable; que llevaran
  // marcador no lo sería, porque entonces serían indistinguibles de un subnodo.
  const marker = `${INDENT.repeat(depth)}- `;
  const continuation = INDENT.repeat(depth + 1);

  return [
    `${marker}${first}`,
    ...rest.map((line) => `${continuation}${line.trim()}`),
  ];
}

function walk(subtrees: Subtree[], depth: number, lines: string[]): void {
  for (const subtree of subtrees) {
    lines.push(...renderNode(subtree.node.content, depth));
    walk(subtree.children, depth + 1, lines);
  }
}

/**
 * El árbol entero como texto. Sin salto final: quien lo inserte en el prompt
 * decide qué va después.
 */
export function serializeTree(nodes: TreeNode[]): string {
  const lines: string[] = [];
  walk(buildTree(nodes), 0, lines);
  return lines.join("\n");
}
