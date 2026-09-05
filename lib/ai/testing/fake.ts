/**
 * Un Proveedor de IA que no llama a nadie.
 *
 * Su trabajo NO es imitar a un modelo: es cumplir el contrato. Existe para que
 * la contract suite (`lib/ai/testing/contract.ts`) tenga contra qué correr sin
 * red ni API key, igual que `lib/backend/testing/in-memory.ts` la corre para el
 * Proveedor de Backend. Si un día la suite deja de pasar contra esto, es la
 * suite la que se rompió, no el modelo.
 *
 * Deduce la Intención por palabras clave y construye los Tickets recorriendo
 * las líneas del árbol serializado. Es tosco a propósito: cuanto más tonto sea
 * el falso, más de lo que pase en la suite será mérito del contrato.
 */

import type { AnalysisOutcome, AnalysisProvider } from "@/lib/ai/port";
import type { AnalysisPromptInput } from "@/lib/ai/prompt";
import { analysisSchema, type Analysis, type IntentKind } from "@/lib/ai/schema";

/**
 * Las señales de cada Intención, en el orden en que se preguntan.
 *
 * El orden ES la regla: `proyecto-nuevo` va la ÚLTIMA porque es la respuesta
 * por defecto que el ticket entero existe para evitar. Un árbol que menciona
 * algo desplegado tiene que caer antes en alguna de las de arriba.
 */
const SIGNALS: [IntentKind, RegExp][] = [
  ["fix", /\b(falla|fallo|bug|error|pierde|roto|no funciona)\b/i],
  ["refactor", /\b(refactor|partir|reorganizar|sin cambiar (su )?(el )?comportamiento)\b/i],
  ["ui", /\b(no se ve|pantalla|botón|pliegue|diseño)\b/i],
  ["infra", /\b(desplieg|proveedor|entorno|migrar|ci\b)/i],
  ["docs", /\b(documentar|documentación|readme|ejemplo por)\b/i],
  ["feature", /\b(añadir|agregar|nueva funcionalidad)\b/i],
  ["otro", /\b(revisar si|comparar|evaluar|conviene)\b/i],
  ["proyecto-nuevo", /\b(desde cero|nuevo proyecto|empezar)\b/i],
];

function deduceIntent(tree: string): IntentKind {
  for (const [kind, signal] of SIGNALS) {
    if (signal.test(tree)) return kind;
  }
  return "otro";
}

/** Una línea del árbol serializado, con su profundidad y su texto. */
function parseLine(line: string): { depth: number; text: string } | null {
  const match = /^(\s*)- (.*)$/.exec(line);
  if (!match) return null;
  return { depth: match[1].length / 2, text: match[2] };
}

/**
 * Un Ticket por raíz, y los descendientes de esa raíz como sus Checks.
 *
 * Así se cumple sin trampa lo que la suite va a afirmar: todo Nodo del árbol
 * —padre e hijo por igual— queda representado. Una raíz sin hijos se queda sin
 * Checks, y el schema la rechazaría, así que se le pone uno derivado de su
 * propio texto: es exactamente lo que se le pide al modelo que haga.
 */
function buildTickets(tree: string): Analysis["tickets"] {
  const tickets: Analysis["tickets"] = [];

  for (const line of tree.split("\n")) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    if (parsed.depth === 0) {
      tickets.push({
        id: `t${tickets.length + 1}`,
        title: parsed.text,
        build: `Construir: ${parsed.text}`,
        checks: [],
        blockedBy: tickets.length > 0 ? [`t${tickets.length}`] : [],
      });
      continue;
    }

    tickets[tickets.length - 1]?.checks.push(parsed.text);
  }

  for (const ticket of tickets) {
    if (ticket.checks.length === 0) ticket.checks.push(`Se verifica: ${ticket.title}`);
  }

  return tickets;
}

/**
 * Cómo se llama el modelo que no existe.
 *
 * Tiene nombre —y no cadena vacía— porque el puerto promete que todo Análisis
 * se guarda diciendo con qué modelo se hizo, y un Análisis del falso también se
 * guarda. Al leerlo después, `sin-modelo` dice la verdad de golpe.
 *
 * Se EXPORTA porque la suite E2E lo lee: el panel enseña el modelo de cada
 * Análisis, así que este texto en pantalla es la prueba de que la corrida no
 * está hablando con Gemini. Una segunda copia del literal en el test se
 * desincronizaría el día que este cambie, y entonces el cortafuegos de la cuota
 * dejaría de cerrar sin que nada avisara.
 */
export const FAKE_MODEL = "sin-modelo";

/**
 * El proveedor falso.
 *
 * `analyze` es `async` y no síncrono aunque no espere a nada: el contrato es
 * asíncrono porque un modelo de verdad lo es, y un falso que devolviera un
 * valor pelado dejaría sin probar el `await` de quien llama.
 *
 * `models` es una lista de uno. No finge una cadena de reserva: caer de un
 * modelo a otro es una estrategia del adaptador de Gemini, no del puerto, y un
 * falso que la imitara probaría su propia imitación.
 */
export function fakeAnalysisProvider(): AnalysisProvider {
  return {
    name: "falso",
    models: [FAKE_MODEL],
    async analyze({ serializedTree, guidelines }: AnalysisPromptInput): Promise<AnalysisOutcome> {
      const tickets = buildTickets(serializedTree);

      // Las Directrices ganan también aquí: son la única palanca del usuario
      // para corregir la Intención (ADR 0003), y un falso que las ignorara
      // dejaría esa regla sin proveedor contra el que probarse.
      const source = guidelines?.trim() || serializedTree;

      const analysis = analysisSchema.parse({
        intent: {
          kind: deduceIntent(source),
          rationale: guidelines?.trim()
            ? "Lo dicen las Directrices del Usuario."
            : `Se dedujo del texto del árbol: «${tickets[0]?.title ?? ""}».`,
        },
        summary: `El árbol pide ${tickets.length} bloques de trabajo.`,
        questions: [],
        spec: {
          problem: tickets[0]?.title ?? "",
          solution: `Resolver, en orden, ${tickets.map((t) => t.title).join("; ")}.`,
          decisions: [],
          testing: [],
          outOfScope: [],
          checks: [`El árbol queda cubierto por los ${tickets.length} Tickets`],
        },
        tickets,
      } satisfies Analysis);

      return { analysis, model: FAKE_MODEL };
    },
  };
}
