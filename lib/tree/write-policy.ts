/**
 * Qué le pasa al árbol local después de cada escritura.
 *
 * Hasta #50 la respuesta era una sola y no estaba escrita en ninguna parte:
 * TODA escritura de estructura releía el árbol entero. Era correcto por fuerza
 * bruta —lo que se pinta viene siempre del motor— y costaba una lectura del
 * árbol completo por cada Nodo creado, movido o borrado.
 *
 * Lo que obligó a cambiarla no fue el gasto sino el Nodo optimista: si crear
 * pinta el Nodo antes de que la escritura llegue, la relectura que viene
 * después lo borraría y lo devolvería medio segundo más tarde. Aparecer y
 * desaparecer es peor que tardar.
 *
 * Así que la política pasa a estar aquí, dicha, y con test. La consistencia del
 * árbol depende de ella: lo que se decida mal en este archivo se ve como un
 * árbol que enseña algo que el motor no tiene. Ver el ADR 0005.
 *
 * ── La regla ──────────────────────────────────────────────────────────────
 *
 * Se relee cuando la escritura puede cambiar filas que quien llamó **no
 * nombró**. Cuando lo único que cambia es la fila que se tocó, el motor ya la
 * devuelve y aplicarla es exacto.
 *
 * Lo que cambia filas sin nombrarlas son las que REPARTEN puestos entre
 * hermanos: reordenar corre a todos los que van detrás, crear un hermano
 * reordena justo después de nacer, y re-parentar mueve un Nodo a otra lista.
 * Ninguna devuelve las filas que tocó de paso, y deducirlas aquí sería
 * reimplementar el plan del dominio dentro de la pantalla — dos copias de una
 * regla que ya tiene dueño.
 */

import type { TreeNode } from "@/lib/backend/ports";

/**
 * Las escrituras de estructura, nombradas por lo que hacen y no por el método
 * que las manda.
 *
 * `createSibling` es una entrada propia y no un `create` cualquiera, y ahí está
 * el matiz que este módulo existe para no perder: crear un hermano son DOS
 * escrituras —nace el último y después se le trae a su sitio— y la segunda
 * renumera a los demás.
 */
export type TreeWrite =
  | "create"
  | "createSibling"
  | "createQuestion"
  | "edit"
  | "complete"
  | "reorder"
  | "reparent"
  | "remove";

/**
 * `local` — el árbol de después se deduce aquí, con lo que devolvió el motor.
 * `reread`  — no se puede deducir: hay que volver a preguntar.
 */
export type FollowUp = "local" | "reread";

/**
 * El conjunto está aquí y no en un `switch` para que se lea de un vistazo.
 *
 * `createQuestion` está por otro motivo que los tres de abajo: crea DOS Nodos
 * —la pregunta y el hueco para contestarla— y solo devuelve uno. Lo que falta
 * no es una fila renumerada, es una fila entera.
 */
const REREADS: ReadonlySet<TreeWrite> = new Set<TreeWrite>([
  "createSibling",
  "createQuestion",
  "reorder",
  "reparent",
]);

export function followUp(write: TreeWrite): FollowUp {
  return REREADS.has(write) ? "reread" : "local";
}

/** Las que dejan un Nodo NUEVO al que hay que llevar el foco. */
const CREATES: ReadonlySet<TreeWrite> = new Set<TreeWrite>([
  "create",
  "createSibling",
  "createQuestion",
]);

/**
 * ¿Esta escritura deja un Nodo abierto para escribir dentro?
 *
 * Solo crear. Un Nodo nuevo nace vacío y lo siguiente que va a pasar es que
 * alguien teclee en él, así que se selecciona y se abre su campo.
 *
 * Existe como pregunta propia porque durante un tiempo la respuesta se dedujo
 * de otra cosa —«¿devolvió el motor una fila?»— y eso era cierto solo mientras
 * únicamente crear devolviera algo. En cuanto `setCompleted` empezó a devolver
 * su fila para poder aplicarla en local (#50), marcar una tarea como terminada
 * abría el campo de texto: dos preguntas distintas contestadas por el mismo
 * `if`. Devolver una fila y crear un Nodo no son lo mismo, y ahora tampoco lo
 * parecen.
 */
export function opensEditor(write: TreeWrite): boolean {
  return CREATES.has(write);
}

/**
 * Cómo se reconoce un Nodo que todavía no existe en el motor.
 *
 * Un prefijo y no una bandera aparte porque el id viaja SOLO: es lo que guarda
 * la selección, lo que compara cada fila para saber si es la abierta y lo que
 * lleva la clave de React. Una bandera en un segundo sitio se habría quedado
 * atrás en alguno de los tres.
 *
 * Y con dos puntos dentro a propósito: un UUID no los tiene, así que un id
 * optimista no puede confundirse con uno real ni al revés.
 */
export const OPTIMISTIC_PREFIX = "optimista:";

let sequence = 0;

/** Un id temporal, único dentro de esta pestaña. */
export function optimisticId(): string {
  sequence += 1;
  return `${OPTIMISTIC_PREFIX}${sequence}`;
}

export function isOptimistic(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

/**
 * Dónde nace el Nodo optimista, para que no dé un salto al llegar la respuesta.
 *
 * Es la mitad de esto que se hizo mal la primera vez, y el síntoma se veía
 * entero: crear un hermano lo pintaba AL FINAL de la lista y medio segundo
 * después lo movía a su sitio, justo detrás de la referencia. Un salto es la
 * forma más clara de decir «esto que te enseñé no era verdad».
 *
 * Venía de tratar las tres creaciones como una. No lo son:
 *
 *   · Una raíz y un subnodo nacen **los últimos** de sus hermanos, que es lo
 *     único que sabe hacer el repositorio.
 *   · Un hermano nace **detrás de su referencia**, porque `createSibling` da un
 *     segundo paso —`reorder`— para traerlo a su puesto. Escribir la idea es
 *     encadenar: lo siguiente va después de esto, no al final de todo.
 *
 * El puesto de en medio se calcula como el PUNTO MEDIO entre la referencia y el
 * hermano que la sigue, y no como «referencia + 1»: ese número ya lo ocupa
 * alguien, y `buildTree` desempata por id, así que el Nodo caería antes o
 * después según qué id le tocara — inestable, que es justo lo que se venía a
 * quitar. Un valor fraccionario cae en su sitio sin colisionar y sin mover a
 * nadie.
 *
 * Que no sea entero no importa: este número no se escribe nunca. El Nodo
 * optimista no llega al motor, y `createSibling` RELEE (ver `followUp`), así
 * que el orden definitivo lo pone el dominio.
 *
 * @param afterSiblingId detrás de quién va, o `null` para el final.
 */
export function optimisticOrderIndex(
  nodes: TreeNode[],
  parentId: string | null,
  afterSiblingId: string | null,
): number {
  const siblings = nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const last = siblings.at(-1);
  const atEnd = last === undefined ? 0 : last.orderIndex + 1;
  if (afterSiblingId === null) return atEnd;

  const at = siblings.findIndex((node) => node.id === afterSiblingId);
  // La referencia ya no está —la borró otro dispositivo mientras se pulsaba—.
  // Al final, que es donde el repositorio lo pondría de todas formas.
  if (at === -1) return atEnd;

  const reference = siblings[at];
  const next = siblings[at + 1];
  return next
    ? (reference.orderIndex + next.orderIndex) / 2
    : reference.orderIndex + 1;
}

/**
 * El Nodo que se pinta mientras la escritura viaja.
 *
 * Nace vacío y en el puesto que le va a dar el motor: ver
 * `optimisticOrderIndex`, que es quien lo calcula.
 *
 * Las fechas son las de este instante y no las del motor. Es lo único que puede
 * discrepar, y no se ve en ninguna parte: la pantalla del árbol no las enseña.
 */
export function optimisticNode(input: {
  id: string;
  versionId: string;
  parentId: string | null;
  orderIndex: number;
}): TreeNode {
  const now = new Date();
  return {
    id: input.id,
    versionId: input.versionId,
    parentId: input.parentId,
    content: "",
    orderIndex: input.orderIndex,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** El árbol con el Nodo optimista dentro. */
export function withOptimistic(nodes: TreeNode[], draft: TreeNode): TreeNode[] {
  return [...nodes, draft];
}

/**
 * El Nodo temporal, sustituido por el que devolvió el motor.
 *
 * Se sustituye EN SU SITIO y no se quita y se añade al final: el orden de la
 * lista plana no decide nada —`buildTree` ordena por `orderIndex`— pero sí
 * decide en qué orden React reconcilia, y mover la fila la desmonta y la vuelve
 * a montar. Con el campo abierto dentro, eso es perder el foco justo cuando
 * alguien empieza a escribir.
 */
export function settleOptimistic(
  nodes: TreeNode[],
  temporaryId: string,
  created: TreeNode,
): TreeNode[] {
  return nodes.map((node) => (node.id === temporaryId ? created : node));
}

/**
 * El árbol sin ese Nodo y sin nada que colgara de él.
 *
 * Sirve para las dos caras de esto: deshacer un Nodo optimista cuya escritura
 * falló —que nunca tiene hijos— y aplicar un borrado que sí salió, donde la
 * cascada del motor (`on delete cascade` sobre `parent_id`) se lleva el
 * subárbol entero. Es la MISMA operación, así que se escribe una vez: dos
 * copias acabarían discrepando justo en si los nietos caen o no.
 *
 * Iterativo y no recursivo, por lo mismo que el resto de `lib/tree`: la
 * profundidad no está acotada por nada.
 */
export function withoutSubtree(nodes: TreeNode[], rootId: string): TreeNode[] {
  const doomed = new Set([rootId]);

  // Varias pasadas: una lista plana no viene ordenada de padres a hijos, así
  // que un nieto puede aparecer antes que su padre. Se repite mientras se siga
  // encontrando descendencia nueva.
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of nodes) {
      if (node.parentId !== null && doomed.has(node.parentId) && !doomed.has(node.id)) {
        doomed.add(node.id);
        grew = true;
      }
    }
  }

  return nodes.filter((node) => !doomed.has(node.id));
}

/** La fila que devolvió el motor, encima de la que había. */
export function applyUpdated(nodes: TreeNode[], updated: TreeNode): TreeNode[] {
  return nodes.map((node) => (node.id === updated.id ? updated : node));
}

/**
 * El Nodo recién creado, dentro del árbol.
 *
 * Con id temporal sustituye al optimista; sin él —crear sin adelantarlo, que es
 * lo que hace el Panel de Análisis— se añade. Las dos cosas en una función
 * porque quien llama no debería tener que acordarse de cuál toca: lo que sabe
 * es que acaba de crear algo.
 */
export function applyCreated(
  nodes: TreeNode[],
  temporaryId: string | null,
  created: TreeNode,
): TreeNode[] {
  if (temporaryId) return settleOptimistic(nodes, temporaryId, created);
  return nodes.some((node) => node.id === created.id)
    ? applyUpdated(nodes, created)
    : [...nodes, created];
}
