/**
 * La capa de servicios de Nodos.
 *
 * Mismo contrato que `projects.ts` y por la misma razón (ADR 0001): «cero
 * llamadas al backend desde componentes o páginas». Lo que este servicio añade
 * sobre el repositorio es el DOMINIO: las reglas del árbol viven en `lib/tree`,
 * puras y sin I/O, y aquí es donde se aplican antes de escribir.
 *
 * El reparto, para que no se difumine con el tiempo:
 *
 *   · `lib/tree` decide QUÉ es válido y QUÉ habría que escribir. No sabe que
 *     existe un backend.
 *   · este archivo lee el árbol, le pregunta, y escribe. No decide nada.
 *   · el repositorio traduce a filas. No sabe que existe un árbol.
 *
 * Todo método que valide lee antes el árbol entero de la Versión. Es una
 * lectura de más por operación, y es deliberada: la alternativa es una regla
 * de integridad que solo se cumple si el cliente tenía el árbol fresco en
 * memoria, y eso no es una invariante, es una casualidad.
 */

import { getBackend } from "@/lib/backend";
import {
  ConflictError,
  NotFoundError,
  type BackendProvider,
  type TreeNode,
} from "@/lib/backend/ports";
import {
  countDescendants,
  buildTree,
  nextOrderIndex,
  REPARENT_RULES,
  reorderPlan,
  reparentRejection,
  siblingIndexOf,
  type ReparentRule,
  type Subtree,
} from "@/lib/tree/model";
import { serializeTree } from "@/lib/tree/serialize";

export type NodeService = {
  /** El árbol de una Versión, plano y ya ordenado. */
  list(versionId: string): Promise<TreeNode[]>;
  /** Lo mismo, ya construido: las raíces con todo colgando. */
  tree(versionId: string): Promise<Subtree[]>;
  /**
   * El árbol como texto para la IA.
   *
   * Vive aquí y no en el Proveedor de IA porque serializar es una operación
   * del árbol, no de la IA: el día que haya un segundo consumidor —una
   * exportación, un `.md`— no habrá que sacarla de dentro de un proveedor.
   */
  serialize(versionId: string): Promise<string>;
  /** Una idea suelta, la última de las raíces. */
  createRoot(versionId: string, content?: string): Promise<TreeNode>;
  /** Un subnodo, el último de sus hermanos. @throws ConflictError */
  createChild(
    versionId: string,
    parentId: string,
    content?: string,
  ): Promise<TreeNode>;
  /**
   * Un Nodo al lado de otro: mismo padre, justo detrás de él.
   *
   * Es la operación que la Vista Registro necesita y que `createChild` no
   * cubre: al escribir una lista de ideas, lo siguiente que se quiere no es un
   * subnodo del último, sino otro a su altura — y en su sitio, no al final.
   *
   * @throws NotFoundError si la referencia no está en la Versión.
   */
  createSibling(
    versionId: string,
    siblingId: string,
    content?: string,
  ): Promise<TreeNode>;
  /** El texto, tal cual se teclea. @throws NotFoundError */
  edit(id: string, content: string): Promise<TreeNode>;
  /**
   * Cuelga el Nodo de otro padre —o de ninguno, con `null`—, el último de sus
   * hermanos nuevos.
   *
   * @throws ConflictError si el destino es él mismo o uno de sus subnodos.
   * @throws NotFoundError
   */
  reparent(
    versionId: string,
    nodeId: string,
    parentId: string | null,
  ): Promise<TreeNode>;
  /** Mueve un Nodo entre sus hermanos. El destino se recorta al rango. */
  reorder(versionId: string, nodeId: string, toIndex: number): Promise<void>;
  /** Cuántos Nodos se van con él: la cifra de la confirmación de borrado. */
  countDescendants(versionId: string, nodeId: string): Promise<number>;
  /** Se lleva el subárbol entero. @throws NotFoundError */
  remove(id: string): Promise<void>;
};

/**
 * Los mensajes de los rechazos, todos en un sitio. Ver `PROJECT_ERRORS`.
 *
 * Indexado por la REGLA que devuelve el dominio, no por una clave inventada
 * aquí: así una regla nueva en `REPARENT_RULES` no compila hasta que alguien
 * le escribe su frase en español.
 */
export const NODE_ERRORS: Record<ReparentRule, string> = {
  [REPARENT_RULES.unknownNode]: "Ese Nodo ya no está en esta Versión.",
  [REPARENT_RULES.unknownParent]: "El Nodo de destino no está en esta Versión.",
  [REPARENT_RULES.cycle]:
    "Un Nodo no puede colgar de sí mismo ni de uno de sus subnodos.",
};

/**
 * Cómo se nombra un Nodo en un `NotFoundError`.
 *
 * Copiado del `RESOURCE` del núcleo y no importado de él: ese vive dentro de
 * un adaptador, y un servicio que importe de `adapters/` invierte el límite
 * del ADR 0001. Son dos palabras; el precio de la copia es menor que el de
 * la dependencia.
 */
const NODE_RESOURCE = "el Nodo";

export function createNodeService(backend: BackendProvider): NodeService {
  /** El árbol de la Versión, que es la entrada de todo el dominio. */
  function read(versionId: string): Promise<TreeNode[]> {
    return backend.nodes.listByVersion(versionId);
  }

  /**
   * El Nodo dentro del árbol que se acaba de leer, o se acabó.
   *
   * Que no esté significa una de dos: no existe, o la Versión no es tuya y la
   * RLS devolvió cero filas. Las dos son `NotFoundError` y con el mismo texto,
   * exactamente por lo que explica `errors.ts`: distinguirlas le confirmaría a
   * un atacante que el recurso existe.
   *
   * Es lo que ya hacen `edit` y `remove` sin ayuda —el repositorio lo hace por
   * ellos—, y pasarlo por aquí es lo que deja el contrato UNIFORME: toda
   * operación sobre un Nodo que no se ve falla igual, la haga quien la haga.
   */
  function requireNode(nodes: TreeNode[], nodeId: string): TreeNode {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new NotFoundError(NODE_RESOURCE, nodeId);
    return node;
  }

  /**
   * Comprueba el movimiento contra el dominio y traduce el rechazo.
   *
   * `ConflictError` con la regla del dominio como `rule`: la interfaz puede
   * distinguir un ciclo de un destino desaparecido sin leer el mensaje, y el
   * mensaje ya viene en español desde `NODE_ERRORS`. `unknownNode` no llega
   * aquí nunca —`requireNode` lo ataja antes, y como `NotFoundError`—, pero la
   * traducción lo cubre porque el dominio puede devolverlo.
   */
  function assertReparent(
    nodes: TreeNode[],
    nodeId: string,
    parentId: string | null,
  ): void {
    const rejection = reparentRejection(nodes, nodeId, parentId);
    if (!rejection) return;
    throw new ConflictError(rejection, NODE_ERRORS[rejection]);
  }

  return {
    list(versionId) {
      return read(versionId);
    },

    async tree(versionId) {
      return buildTree(await read(versionId));
    },

    async serialize(versionId) {
      return serializeTree(await read(versionId));
    },

    async createRoot(versionId, content = "") {
      return backend.nodes.create({
        versionId,
        parentId: null,
        content,
        orderIndex: nextOrderIndex(await read(versionId), null),
      });
    },

    async createChild(versionId, parentId, content = "") {
      const nodes = await read(versionId);
      // El padre se comprueba ANTES de escribir. El motor solo garantiza que
      // padre e hijo comparten Versión; que el padre EXISTA en esta Versión lo
      // decide el dominio, y decidirlo aquí evita dejar un Nodo huérfano
      // colgando de un id que no era.
      if (!nodes.some((node) => node.id === parentId)) {
        throw new ConflictError(
          REPARENT_RULES.unknownParent,
          NODE_ERRORS[REPARENT_RULES.unknownParent],
        );
      }
      return backend.nodes.create({
        versionId,
        parentId,
        content,
        orderIndex: nextOrderIndex(nodes, parentId),
      });
    },

    async createSibling(versionId, siblingId, content = "") {
      const nodes = await read(versionId);
      const sibling = requireNode(nodes, siblingId);

      // Nace el último —es lo único que sabe hacer el repositorio— y después
      // se le trae a su sitio. Dos escrituras y no una porque el puesto de un
      // Nodo es su `orderIndex` RELATIVO a sus hermanos: insertarlo en medio
      // de verdad obligaría a correr a todos los que van detrás, que es
      // exactamente lo que `reorderPlan` ya sabe planear.
      const created = await backend.nodes.create({
        versionId,
        parentId: sibling.parentId,
        content,
        orderIndex: nextOrderIndex(nodes, sibling.parentId),
      });

      // El puesto se cuenta sobre el árbol de ANTES, que es donde estaba la
      // referencia; el recién nacido va justo detrás. `reorder` vuelve a leer
      // —y ahí ya se ve a sí mismo—, así que el destino cae dentro del rango.
      await this.reorder(versionId, created.id, siblingIndexOf(nodes, siblingId) + 1);

      // Se devuelve la fila del alta y no una relectura: lo único que cambió
      // después fue su `orderIndex`, y quien llama lo que necesita es el id
      // para poner el foco en el campo recién creado.
      return created;
    },

    edit(id, content) {
      // Sin recortar, a diferencia del título de un Proyecto: esto lo manda el
      // autoguardado mientras el usuario teclea, y recortar aquí le borraría el
      // espacio que acaba de escribir entre dos palabras.
      return backend.nodes.update(id, { content });
    },

    async reparent(versionId, nodeId, parentId) {
      const nodes = await read(versionId);
      const node = requireNode(nodes, nodeId);
      // Soltar un Nodo sobre el padre que ya tenía no es un movimiento: es un
      // arrastre que acabó donde empezó. Sin este atajo lo mandaría al final
      // de sus hermanos —`nextOrderIndex` cuenta una lista que todavía lo
      // incluye—, y el usuario vería su Nodo saltar de sitio por no haber
      // hecho nada.
      if (node.parentId === parentId) return node;
      assertReparent(nodes, nodeId, parentId);
      // Se va al final de sus hermanos nuevos en vez de conservar su índice:
      // el que traía es de otra lista y ahí colisionaría con un hermano
      // cualquiera. Los huecos que deja en la lista de la que sale no se
      // compactan —`buildTree` ordena igual, y `reorderPlan` los densifica en
      // el primer reordenado— porque compactarlos serían N escrituras para
      // arreglar algo que no se ve.
      return backend.nodes.update(nodeId, {
        parentId,
        orderIndex: nextOrderIndex(nodes, parentId),
      });
    },

    async reorder(versionId, nodeId, toIndex) {
      const nodes = await read(versionId);
      // Antes de planear. Sin esto, reordenar en la Versión de otro sale por
      // el camino del éxito: la RLS devuelve cero filas, el plan queda vacío y
      // el bucle no da ni una vuelta — una escritura denegada que termina
      // diciendo «hecho».
      requireNode(nodes, nodeId);
      // Secuencial y no en paralelo: son escrituras sobre filas hermanas y el
      // orden en que aterrizan es el resultado. Un `Promise.all` las dejaría a
      // merced de la red.
      for (const write of reorderPlan(nodes, nodeId, toIndex)) {
        await backend.nodes.update(write.id, { orderIndex: write.orderIndex });
      }
    },

    async countDescendants(versionId, nodeId) {
      return countDescendants(await read(versionId), nodeId);
    },

    remove(id) {
      return backend.nodes.delete(id);
    },
  };
}

/**
 * El servicio sobre el Proveedor de Backend activo. Sin memoizar, por lo mismo
 * que `projectService()`.
 */
export function nodeService(): NodeService {
  return createNodeService(getBackend());
}
