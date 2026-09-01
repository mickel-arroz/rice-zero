/**
 * El Análisis, a texto plano para pegar.
 *
 * Aquí es donde se CUMPLE «texto plano sin adorno», y se cumple porque no hay
 * ninguna línea de código que escriba adorno — no porque se le haya pedido al
 * modelo (ADR 0003). Lo que un modelo hace con «no uses negritas» es obedecer
 * casi siempre; lo que hace un renderer sin `**` es no escribirlas nunca.
 *
 * Permitido: `- `, `1. `, `- [ ]` y líneas de título en mayúsculas. Prohibido
 * y ausente: negritas, cursivas, tablas, emojis, code fences y encabezados con
 * almohadilla.
 *
 * Puros y sin I/O. El Master Prompt no se persiste: `ai_analyses` guarda el
 * objeto y esto se ejecuta al leerlo, así que cambiar el formato es cambiar
 * este archivo y no migrar nada.
 */

import { ticketsById, type Analysis, type Ticket } from "@/lib/ai/schema";

/**
 * Cómo se nombra cada Intención en el texto.
 *
 * Un mapa explícito y no el propio valor del enum porque lo que se pega en un
 * agente lo lee también una persona, y `proyecto-nuevo` es una clave, no una
 * palabra. El enum sigue yendo al lado: es lo que un test puede afirmar.
 */
const INTENT_LABELS: Record<Analysis["intent"]["kind"], string> = {
  "proyecto-nuevo": "Proyecto nuevo",
  feature: "Feature",
  fix: "Fix",
  refactor: "Refactor",
  ui: "UI",
  infra: "Infraestructura",
  docs: "Documentación",
  otro: "Otro",
};

/**
 * El adorno que el CONTENIDO puede traer, aunque el renderer no lo escriba.
 *
 * `\p{Extended_Pictographic}` cubre los emojis sin listarlos a mano; el
 * `️` opcional se lleva el selector de variación que los sigue, que es
 * invisible y quedaría suelto en el texto.
 */
const EMOJI = /\p{Extended_Pictographic}️?/gu;
const ADORNMENT = /[*_#|`~]/g;

/**
 * Un texto del modelo, limpio de adorno.
 *
 * El renderer no escribe negritas, pero el modelo sí las mete DENTRO de un
 * título o de un Check. Sin este paso, «sin adorno» sería verdad del andamio y
 * mentira del contenido.
 */
function plain(text: string): string {
  return (
    text
      .replace(EMOJI, "")
      // El guion bajo tiene dos vidas y no se pueden tratar igual. Entre dos
      // caracteres de palabra es un identificador —`ai_analyses`, `blocked_by`—
      // y borrarlo dejaría `aianalyses`, ilegible justo para el agente de
      // código que recibe esto. Se cambia por un guion normal: pierde la forma
      // exacta, pero sigue siendo UN token y se reconoce de un vistazo. Suelto
      // o pegado a un espacio es énfasis de Markdown, y ése sí se borra.
      .replace(/(?<=[\p{L}\p{N}])_(?=[\p{L}\p{N}])/gu, "-")
      .replace(ADORNMENT, "")
      // Línea a línea y no sobre el bloque entero: quitar un `**` deja dos
      // espacios donde había uno, y un code fence deja la línea vacía. Los
      // saltos de párrafo que el modelo sí puso a propósito se conservan.
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Una línea de título. Mayúsculas: es el único énfasis que sobrevive al veto. */
function heading(text: string): string {
  return text.toUpperCase();
}

/** Una lista con guiones, o nada si no hay nada que listar. */
function bullets(items: string[]): string[] {
  return items.map((item) => `- ${plain(item)}`);
}

/** Los Checks, con su casilla. La marca `- [ ]` está permitida y es la única. */
function checkboxes(items: string[]): string[] {
  return items.map((item) => `- [ ] ${plain(item)}`);
}

/**
 * Un bloque con su título, o nada.
 *
 * Devuelve una lista de bloques y no un texto porque un bloque vacío no se
 * pinta: un «FUERA DE ALCANCE» seguido de nada es peor que su ausencia, y
 * juntar con `filter(Boolean)` esconde el caso en vez de decidirlo.
 */
function section(title: string, lines: string[]): string[] {
  return lines.length === 0 ? [] : [[heading(title), ...lines].join("\n")];
}

/** Un bloque de prosa con su título. La prosa siempre está: el schema la exige. */
function prose(title: string, text: string): string {
  return `${heading(title)}\n${plain(text)}`;
}

/** La Intención, dicha en una línea y su porqué debajo. */
function intentBlock(analysis: Analysis): string {
  const { kind, rationale } = analysis.intent;
  return `${heading("Intención")}: ${INTENT_LABELS[kind]}\n${plain(rationale)}`;
}

/** Un Ticket entero: título, qué construir, bloqueos y Checks. */
function ticketBlock(ticket: Ticket, byId: Map<string, Ticket>): string {
  const blockers = ticket.blockedBy.map(
    (id) => `${id} (${plain(byId.get(id)!.title)})`,
  );

  return [
    `${heading("Ticket")} ${ticket.id}: ${plain(ticket.title)}`,
    plain(ticket.build),
    ...(blockers.length > 0 ? [`BLOQUEADO POR: ${blockers.join(", ")}`] : []),
    heading("Checks"),
    ...checkboxes(ticket.checks),
  ].join("\n");
}

/**
 * El Análisis entero, para pegar en un agente de código.
 *
 * Sin límite de longitud (`CONTEXT.md` → Master Prompt): recortarlo aquí
 * dejaría fuera Tickets, y un Ticket que no se pega no se construye.
 */
export function renderMasterPrompt(analysis: Analysis): string {
  const byId = ticketsById(analysis.tickets);

  return [
    intentBlock(analysis),
    prose("Resumen", analysis.summary),
    ...section(
      "Preguntas que bloquean",
      analysis.questions.map((q, i) => `${i + 1}. ${plain(q)}`),
    ),
    heading("Spec"),
    prose("Problema", analysis.spec.problem),
    prose("Solución", analysis.spec.solution),
    ...section("Decisiones de implementación", bullets(analysis.spec.decisions)),
    ...section("Decisiones de testing", bullets(analysis.spec.testing)),
    ...section("Fuera de alcance", bullets(analysis.spec.outOfScope)),
    ...section("Checks del Spec", checkboxes(analysis.spec.checks)),
    heading("Tickets"),
    ...analysis.tickets.map((ticket) => ticketBlock(ticket, byId)),
  ].join("\n\n");
}

/**
 * Un solo Ticket, con el mínimo de Spec que lo hace entendible suelto.
 *
 * Lleva Intención y problema porque se copia para pegarlo SOLO (historia 41):
 * un agente que recibe «construye el filtro de tallas» sin saber que es un
 * añadido sobre una tienda ya desplegada, la reescribe entera.
 */
export function renderTicketPrompt(analysis: Analysis, ticketId: string): string {
  const ticket = analysis.tickets.find((t) => t.id === ticketId);
  // Lanza en vez de devolver texto vacío: un id que no existe es un bug de
  // quien llama, y un Prompt en blanco copiado al portapapeles no lo delata.
  if (!ticket) throw new Error(`No hay ningún Ticket con id «${ticketId}».`);

  const byId = ticketsById(analysis.tickets);

  return [
    intentBlock(analysis),
    prose("Problema", analysis.spec.problem),
    // Las decisiones del Spec van ENTERAS y sin filtrar. Se intentó elegir
    // «las que apliquen» por solapamiento de palabras con el Ticket, y el fallo
    // de esa heurística es silencioso y caro: descartar una decisión que sí
    // venía al caso no se nota al leer el Prompt, se nota en la implementación
    // que sale mal. Colar una de más cuesta una línea. Un Spec tiene un puñado
    // de decisiones, así que el «mínimo de Spec» del ticket se respeta igual.
    ...section("Decisiones del Spec", bullets(analysis.spec.decisions)),
    ticketBlock(ticket, byId),
  ].join("\n\n");
}
