/**
 * Qué hay bajo el dedo mientras se arrastra un Nodo, y si vale como destino.
 *
 * Es la mitad del arrastre que se puede probar sin navegador. La otra mitad
 * —convertir el puntero en coordenadas del lienzo, pintar el resalte— vive en
 * `canvas-view.tsx`, y ahí no hay ninguna decisión: la decisión es ésta.
 *
 * Vive en `components/canvas` y no en `lib/tree` por lo mismo que `geometry`:
 * no es geometría del ÁRBOL sino de cómo lo dibuja esta vista. `lib/tree` no
 * sabe que existe un puntero.
 *
 * ── Lo que este módulo NO decide ──────────────────────────────────────────
 *
 * Si un destino vale lo dice `reparentRejection`, del dominio. Aquí no se
 * reimplementa «ni bajo sí mismo ni bajo un descendiente»: se pregunta. Esa es
 * la razón de que el dominio devuelva la regla en vez de lanzar — un arrastre
 * pregunta una vez por fotograma, y una excepción por fotograma sería usar el
 * mecanismo de los fallos para dibujar. Ver `lib/tree/model.ts`.
 */

import type { TreeNode } from "@/lib/backend/ports";
import type { NodeBox } from "@/lib/tree/layout";
import { reparentRejection, type ReparentRule } from "@/lib/tree/model";

/** Un punto en las coordenadas del bosque: las mismas que devuelve el layout. */
export type Point = {
  x: number;
  y: number;
};

/**
 * Cómo se marca un Nodo mientras OTRO va en el aire por encima de él.
 *
 * Vive aquí y no en la vista que lo pinta porque es la misma decisión que
 * `DropTarget`: el día que haya un tercer estado —«vale, pero no cambia
 * nada»— se añade en un sitio y no en dos.
 */
export type DropMark = "valid" | "blocked";

/** El Nodo bajo el puntero mientras se arrastra, y si se puede soltar ahí. */
export type DropTarget = {
  id: string;
  /**
   * La regla que impide soltarlo ahí, o `null` si el destino vale.
   *
   * Se guarda la REGLA y no un booleano porque quien pinta el aviso necesita
   * decir POR QUÉ no vale, y esa frase ya está escrita una vez en
   * `NODE_ERRORS`, indexada exactamente por esto.
   */
  rejection: ReparentRule | null;
};

/**
 * La caja que contiene este punto, o `null` si el punto cae en el aire.
 *
 * Los bordes se tratan como un intervalo medio abierto —entra el de arriba y
 * el de la izquierda, no los de enfrente—, así que dos cajas pegadas no pueden
 * reclamar el mismo píxel. Hoy el layout siempre deja aire entre Nodos y da
 * igual; la regla no depende de que siga siendo así.
 *
 * Se queda con la PRIMERA que contiene el punto porque `layoutForest` no
 * solapa Nodos: como mucho hay una.
 */
export function boxAt(boxes: NodeBox[], point: Point): NodeBox | null {
  return (
    boxes.find(
      (box) =>
        point.x >= box.x &&
        point.x < box.x + box.width &&
        point.y >= box.y &&
        point.y < box.y + box.height,
    ) ?? null
  );
}

/**
 * El destino de un arrastre: qué Nodo hay bajo el puntero y si vale.
 *
 * Devuelve `null` cuando no hay ninguno, y eso incluye el caso de soltar sobre
 * el hueco que el propio Nodo dejó al empezar a moverse: su caja sigue en el
 * layout mientras el dedo se lo lleva, y marcarla sería teñir de rechazo el
 * sitio del que salió. Volver al punto de partida es cancelar, no fallar.
 *
 * @param nodes el árbol vivo, para preguntarle al dominio.
 * @param boxes el bosque ya colocado, en las mismas coordenadas que `point`.
 * @param draggedId el Nodo que va en el aire.
 */
export function dropTargetAt(
  nodes: TreeNode[],
  boxes: NodeBox[],
  draggedId: string,
  point: Point,
): DropTarget | null {
  // El Nodo que va en el aire se descarta ANTES de acertar y no después: su
  // caja sigue donde el layout la dejó, y si se filtrara el resultado en vez
  // de las candidatas, pasar por encima de su propio hueco no devolvería nada
  // pero tampoco dejaría ver al Nodo que hay debajo. Hoy da igual porque el
  // layout no solapa; el orden correcto no depende de que siga siendo así.
  const box = boxAt(
    boxes.filter((candidate) => candidate.id !== draggedId),
    point,
  );
  if (!box) return null;

  // Y aquí se PREGUNTA. La regla —ni bajo sí mismo, ni bajo un descendiente—
  // vive en el dominio y no se repite: si algún día cambia, cambia en un solo
  // sitio y esta vista se entera sola.
  return { id: box.id, rejection: reparentRejection(nodes, draggedId, box.id) };
}

/** El resalte que le toca al destino: la regla del dominio hecha dibujo. */
export function dropMark(target: DropTarget | null): DropMark | null {
  if (!target) return null;
  return target.rejection === null ? "valid" : "blocked";
}
