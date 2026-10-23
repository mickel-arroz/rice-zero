/**
 * La Propuesta de Nodos, convertida en el plan de escrituras que la mete en el
 * árbol.
 *
 * Función pura, y aparte de quien la ejecuta, por la promesa que el glosario
 * hace de la Propuesta: «nunca toca un Nodo existente; todo lo que trae entra
 * como raíz nueva». Esa promesa se puede afirmar AQUÍ, sobre el plan, sin red
 * ni motor: si ningún paso nombra un Nodo de fuera del plan, ningún Nodo de
 * fuera puede cambiar.
 *
 * Los padres se nombran por una clave LOCAL y no por id: los ids los pone el
 * motor al crear, así que no existen hasta que el paso anterior se ejecuta.
 * Quien ejecuta el plan traduce cada clave al id real conforme va creando.
 */

import type { Proposal } from "@/lib/ai/proposal";

/**
 * El plan se cortó a medias: parte de la Propuesta ya está en el árbol.
 *
 * Una clase propia y no un `Error` cualquiera porque quien la recibe tiene que
 * hacer algo DISTINTO: un fallo antes del primer Nodo se puede reintentar tal
 * cual, y éste no — volver a añadir duplicaría las raíces que ya entraron.
 */
export class PartialProposalError extends Error {
  constructor(
    message: string,
    readonly created: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PartialProposalError";
  }
}

export type NodeCreation = {
  /** Clave local de esta creación, única dentro del plan. */
  key: string;
  /**
   * De qué creación ANTERIOR del plan cuelga, o `null` si es una raíz nueva.
   * Nunca un id del árbol: eso es lo que garantiza que nada existente cambie.
   */
  parentKey: string | null;
  content: string;
};

/**
 * El plan, en un orden que se puede ejecutar de principio a fin.
 *
 * Dos reglas que el orden tiene que cumplir, y que los tests afirman:
 *   · todo padre va ANTES que sus hijos (al crear un hijo, su padre ya tiene id);
 *   · los hermanos van en el orden propuesto: el repositorio crea cada Nodo el
 *     último de sus hermanos, así que el orden de creación ES el orden final.
 */
export function proposalCreations(proposal: Proposal): NodeCreation[] {
  // Preorden, y la clave es la ruta de índices: «0.1.0» es el primer nieto del
  // segundo hijo de la primera raíz. Se lee de un vistazo al depurar, y su
  // padre es la misma ruta sin el último tramo.
  const creations: NodeCreation[] = [];

  proposal.roots.forEach((root, r) => {
    const rootKey = `${r}`;
    creations.push({ key: rootKey, parentKey: null, content: root.text });

    root.children.forEach((child, c) => {
      const childKey = `${rootKey}.${c}`;
      creations.push({
        key: childKey,
        parentKey: rootKey,
        content: child.text,
      });

      child.children.forEach((leaf, l) => {
        creations.push({
          key: `${childKey}.${l}`,
          parentKey: childKey,
          content: leaf.text,
        });
      });
    });
  });

  return creations;
}
