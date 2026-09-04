/**
 * La forma del Análisis: única fuente de verdad de lo que la IA devuelve.
 *
 * Zod y no un `type` a mano porque este objeto entra desde fuera —lo escribe
 * un modelo, no nosotros— y el ADR 0003 decide que el modelo responda
 * ESTRUCTURADO y validado, no texto. El `.parse` es la frontera: lo que la
 * cruza ya cumple el contrato, y el resto de `lib/ai` puede confiar en él sin
 * volver a comprobar nada.
 *
 * Los tipos salen de `z.infer`, nunca escritos dos veces: un `type` paralelo
 * al schema se desincroniza a la primera y el compilador no se entera.
 *
 * Módulo puro. No importa ningún SDK ni toca red — el adaptador de Gemini
 * (#15) se construye CONTRA esto, no al revés.
 */

import { z } from "zod";

/**
 * Qué clase de trabajo pide el árbol.
 *
 * Enum cerrado y no texto libre porque el panel lo va a etiquetar y un test lo
 * tiene que poder afirmar (`CONTEXT.md` → Intención). `otro` no es un cajón de
 * sastre cómodo: es la respuesta correcta cuando hay duda REAL, y por eso
 * `rationale` es obligatoria.
 */
export const INTENT_KINDS = [
  "proyecto-nuevo",
  "feature",
  "fix",
  "refactor",
  "ui",
  "infra",
  "docs",
  "otro",
] as const;

export type IntentKind = (typeof INTENT_KINDS)[number];

/**
 * Texto que tiene que decir algo.
 *
 * `.trim().min(1)` y no `.min(1)`: un modelo que devuelve `" "` ha fallado
 * igual que uno que devuelve `""`, y sin el trim el segundo se cuela.
 */
const filled = (description: string) =>
  z.string().trim().min(1).describe(description);

export const intentSchema = z.object({
  kind: z.enum(INTENT_KINDS).describe("Qué clase de trabajo pide el árbol."),
  rationale: filled("Una línea: de qué parte del árbol se dedujo la Intención."),
});

/**
 * Un criterio de aceptación binario.
 *
 * Es un `string` y no un objeto con `{ id, text, done }`: el estado de marcado
 * no vive en el Análisis. El Análisis es histórico —se crea, se lee y se
 * borra, pero no se edita (`ports/entities.ts`)—, así que un `done` aquí sería
 * un campo que nadie puede cambiar.
 */
const checkSchema = filled("Un Check: binario, verificable desde fuera.");

/** Al menos uno. La regla del ADR: sin Checks nada se da por terminado. */
const checksSchema = z
  .array(checkSchema)
  .min(1)
  .describe("Los Checks. Nunca vacío.");

export const specSchema = z.object({
  problem: filled("El problema, adaptado a la Intención."),
  solution: filled("La solución, en prosa corta."),
  decisions: z.array(filled("Una decisión de implementación.")),
  testing: z.array(filled("Una decisión de testing.")),
  outOfScope: z.array(filled("Algo que explícitamente NO se hace.")),
  checks: checksSchema,
});

export const ticketSchema = z.object({
  /**
   * Slug estable (`t1`, `t2`…). Lo fija el modelo y no un contador nuestro
   * porque `blockedBy` apunta a él DENTRO de la misma respuesta: renumerar
   * después obligaría a reescribir las referencias.
   */
  id: z
    .string()
    .regex(/^t\d+$/, "El id de un Ticket es `t` y un número: t1, t2…")
    .describe("Id estable del Ticket."),
  title: filled("El título del Ticket, en una línea."),
  build: filled("Qué construir."),
  checks: checksSchema,
  blockedBy: z
    .array(z.string())
    .describe("Ids de los Tickets que hay que terminar antes que éste."),
});

export type Intent = z.infer<typeof intentSchema>;
export type Spec = z.infer<typeof specSchema>;
export type Ticket = z.infer<typeof ticketSchema>;

/**
 * Los Tickets por su id.
 *
 * Vive aquí y no en el renderer porque lo necesitan los dos: el schema para
 * validar `blockedBy` y `lib/ai/render.ts` para nombrar los bloqueos por su
 * título. Dos `new Map(...)` idénticos en dos archivos es la clase de copia
 * que sobrevive al primer cambio de forma del Ticket y no al segundo.
 */
export function ticketsById(tickets: Ticket[]): Map<string, Ticket> {
  return new Map(tickets.map((ticket) => [ticket.id, ticket]));
}

/**
 * El grafo de bloqueos se sostiene: ids únicos, referencias que existen y
 * ningún ciclo.
 *
 * Las tres comprobaciones van juntas y en este orden porque cada una es
 * condición de la siguiente: sin ids únicos el índice pierde Tickets, y un
 * ciclo sobre un id inexistente no es un caso —si la referencia está rota, el
 * ciclo no se puede ni evaluar—.
 *
 * Recorrido en profundidad con tres estados (sin visitar / en la pila /
 * cerrado) y no un `toposort`: lo único que se pregunta es «¿hay ciclo?», y
 * volver a encontrar un id que sigue en la pila lo contesta. El caso
 * degenerado —un Ticket que se apunta a sí mismo— cae por el mismo camino sin
 * escribirle una rama aparte.
 */
function ticketGraphIsSound(tickets: Ticket[]): boolean {
  const byId = ticketsById(tickets);
  if (byId.size !== tickets.length) return false;
  if (tickets.some((t) => t.blockedBy.some((id) => !byId.has(id)))) return false;

  const closed = new Set<string>();
  const onStack = new Set<string>();

  function descend(id: string): boolean {
    if (closed.has(id)) return true;
    if (onStack.has(id)) return false;

    onStack.add(id);
    for (const blocker of byId.get(id)!.blockedBy) {
      if (!descend(blocker)) return false;
    }
    onStack.delete(id);
    closed.add(id);
    return true;
  }

  return tickets.every((ticket) => descend(ticket.id));
}

/**
 * El Análisis entero.
 *
 * Las reglas de integridad son `refine` y no consejos en el prompt: el ADR
 * 0003 las quiere AFIRMADAS. Un Análisis que las incumple se rechaza como
 * malformado, con el mismo camino de error que una respuesta corrupta, y por
 * eso nunca llega a persistirse.
 */
export const analysisSchema = z
  .object({
    intent: intentSchema,
    summary: filled("El árbol entendido, en prosa corta."),
    /**
     * Puede estar vacío, y es correcto que lo esté: una pregunta que no
     * bloquea la implementación es retórica, y el prompt la prohíbe.
     */
    questions: z.array(filled("Un hueco real que impide implementar.")),
    spec: specSchema,
    tickets: z.array(ticketSchema).min(1, "Un Análisis sin Tickets no es ejecutable."),
  })
  .refine((analysis) => ticketGraphIsSound(analysis.tickets), {
    path: ["tickets"],
    message:
      "Los ids de `blockedBy` tienen que ser únicos, existir y no formar ciclos.",
  });

export type Analysis = z.infer<typeof analysisSchema>;

/**
 * El mismo tipo, con el nombre que usa el resto del repo.
 *
 * Existe porque fuera de `lib/ai/` ya hay un `Analysis`: la ENTIDAD que se
 * persiste (`lib/backend/ports/entities.ts`), con su id, su Versión y su fecha.
 * Este es su CONTENIDO. Que cada archivo se inventara su propio alias al
 * importar —`AnalysisObject` aquí, `AiAnalysis` allá— haría que buscar de
 * dónde sale la forma del Análisis fuera una búsqueda por sinónimos.
 *
 * El alias vive aquí, al lado del schema, porque el schema es la fuente de
 * verdad de la forma y no hay dos sitios donde mirar.
 */
export type AnalysisContent = Analysis;
