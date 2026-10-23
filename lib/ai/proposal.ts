/**
 * La forma de la Propuesta de Nodos: lo que la IA devuelve cuando se le pide
 * que haga crecer el árbol (`CONTEXT.md` → Propuesta de Nodos).
 *
 * Es un schema aparte del Análisis y no una sección más de él: no es un
 * Análisis, no se guarda y no entra en el Historial. Comparten solo la
 * frontera —el modelo escribe, Zod decide si lo que escribió vale— y por eso
 * viven al lado, cada una en su archivo.
 *
 * Módulo puro, igual que `schema.ts`: ni SDK ni red.
 */

import { z } from "zod";

/**
 * Los topes del glosario.
 *
 * Constantes con nombre porque los leen tres sitios —este schema, el prompt
 * que se los dice al modelo y el texto de la pantalla— y tres copias de un
 * «5» son tres sitios donde cambiarlo un día y olvidar los otros dos.
 */
export const PROPOSAL_LIMITS = {
  roots: 5,
  nodes: 25,
  depth: 3,
} as const;

const text = z
  .string()
  .trim()
  .min(1)
  .describe("El texto del Nodo: una idea, en una línea.");

/**
 * Los tres niveles, ESCRITOS uno por uno y no con un `z.lazy` recursivo.
 *
 * La profundidad máxima queda así en la forma misma, y no en un `refine` que
 * el modelo no ve: el SDK traduce esto a JSON Schema y se lo manda a Gemini
 * como contrato de salida, y un schema recursivo se traduce con `$ref`, que la
 * salida estructurada de Gemini no sigue bien. Tres objetos planos sí.
 *
 * `.strict()` en cada nivel es lo que hace que un cuarto nivel se RECHACE en
 * vez de recortarse en silencio: sin él, Zod quitaría los `children` de una
 * hoja y la Propuesta llegaría a la pantalla con Nodos de menos sin que nadie
 * se enterase.
 */
const leafSchema = z.object({ text }).strict();

const childSchema = z
  .object({
    text,
    children: z.array(leafSchema).describe("Sus subnodos, del tercer nivel."),
  })
  .strict();

const rootSchema = z
  .object({ text, children: z.array(childSchema).describe("Sus subnodos.") })
  .strict();

/**
 * Cuántos Nodos trae, raíces incluidas.
 *
 * Tipada contra las raíces y no contra `Proposal`: el `refine` de abajo la usa,
 * y `Proposal` sale de ese mismo schema refinado — el tipo se mordería la cola.
 */
export function countProposalNodes(proposal: {
  roots: z.infer<typeof rootSchema>[];
}): number {
  return proposal.roots.reduce(
    (total, root) =>
      total +
      1 +
      root.children.reduce((sub, child) => sub + 1 + child.children.length, 0),
    0,
  );
}

export const proposalSchema = z
  .object({
    roots: z
      .array(rootSchema)
      .min(1, "Una Propuesta sin raíces no propone nada.")
      .max(PROPOSAL_LIMITS.roots)
      .describe(
        "Las raíces nuevas, en el orden en que se añaden al final del árbol.",
      ),
  })
  .strict()
  // Un `refine` y no un `.max` por nivel: el tope es del conjunto, y repartirlo
  // por niveles rechazaría Propuestas que caben y aceptaría otras que no.
  .refine((proposal) => countProposalNodes(proposal) <= PROPOSAL_LIMITS.nodes, {
    path: ["roots"],
    message: `Una Propuesta no puede traer más de ${PROPOSAL_LIMITS.nodes} Nodos.`,
  });

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposalRoot = Proposal["roots"][number];
