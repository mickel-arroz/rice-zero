"use client";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { Checks } from "@/components/analysis/checks";
import { ToTreeIcon } from "@/components/icons/to-tree-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { BlockedIcon } from "@/components/icons/blocked-icon";
import { LABEL_CLASS } from "@/components/layout/site-chrome";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { ticketsById, type AnalysisContent, type Ticket } from "@/lib/ai";
import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * El Análisis, pintado en el orden en que está el objeto (ADR 0003).
 *
 * El orden NO es una preferencia de maquetación: la Intención va arriba del
 * todo porque es lo que el usuario tiene que poder DESMENTIR de un vistazo. Si
 * la IA entendió «proyecto nuevo» donde había un arreglo, todo lo que viene
 * debajo está mal, y leerlo entero para descubrirlo es tiempo perdido.
 *
 * Este componente no decide nada del contenido: lo que enseña es exactamente lo
 * que validó el schema. Ni ordena Tickets, ni resume, ni recorta — el texto que
 * se copia y se pega lo escribe `lib/ai/render.ts`, y esto es su hermano
 * visual. Dos representaciones del mismo objeto, ninguna de las dos
 * autoritativa sobre la otra.
 */
export function AnalysisResult({ analysis }: { analysis: AnalysisContent }) {
  // Una vez para todas las tarjetas. Dentro de `TicketCard` se reconstruía
  // entero en cada una: N índices del mismo array para leer un título.
  const byId = ticketsById(analysis.tickets);

  return (
    <div className="flex flex-col gap-7">
      <Intent analysis={analysis} />

      <section className="flex flex-col gap-2.5">
        <h2 className={LABEL_CLASS}>{ANALYSIS_COPY.summary}</h2>
        <p className="text-[13px] leading-relaxed text-pretty">{analysis.summary}</p>
      </section>

      {/* Vacío es correcto y no un fallo: el prompt prohíbe las preguntas
          retóricas, así que un Análisis sin huecos no tiene ninguna. Pintar la
          sección vacía sugeriría que falta algo. */}
      {analysis.questions.length > 0 ? (
        <Questions questions={analysis.questions} />
      ) : null}

      <Spec spec={analysis.spec} />

      <section className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className={LABEL_CLASS}>{ANALYSIS_COPY.tickets}</h2>
          <span className="text-[11px] text-muted-foreground">
            {ANALYSIS_COPY.ticketCount(analysis.tickets.length)}
          </span>
        </div>
        {analysis.tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} byId={byId} />
        ))}
      </section>
    </div>
  );
}

/**
 * Lo primero que se lee, y la salida cuando está mal.
 *
 * La clase de trabajo va en NDot y grande porque es la única palabra del panel
 * que tiene que entrar por el ojo antes que nada; el porqué va debajo en una
 * línea, que es lo que permite desmentirla sin leer el resto.
 *
 * Y el bloque lleva DENTRO la corrección. No hay selector de Intención (ADR
 * 0003: sería un campo, un control y un catálogo para una señal que el árbol ya
 * lleva escrita), así que la única palanca son las Directrices — y una palanca
 * que no se ve desde donde se descubre el error es una palanca que nadie usa.
 */
function Intent({ analysis }: { analysis: AnalysisContent }) {
  const { askForGuidelines } = useAnalysis();

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-primary p-[18px]">
      <h2 className={LABEL_CLASS}>{ANALYSIS_COPY.intentLabel}</h2>
      <span className="font-display text-[40px] leading-[0.95] tracking-[0.04em] text-primary">
        {ANALYSIS_COPY.intents[analysis.intent.kind]}
      </span>
      <p className="text-[13px] leading-relaxed text-pretty">
        {analysis.intent.rationale}
      </p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[11px] text-muted-foreground">
          {ANALYSIS_COPY.intentWrong}
        </span>
        {/* Despliega el campo de Directrices del pie y le lleva el cursor. No
            toca el Análisis —no se puede, es histórico— ni regenera por su
            cuenta: deja a la persona escribiendo la corrección.

            Era un ancla a `#directrices` y no servía de nada: el pie ya está
            visible —está anclado, no se desplaza— y estaba PLEGADO, así que el
            enlace no producía ningún efecto observable. */}
        <button
          type="button"
          onClick={askForGuidelines}
          className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase text-primary transition-opacity hover:opacity-75"
        >
          {ANALYSIS_COPY.intentFix}
          <ChevronRightIcon width={14} height={14} />
        </button>
      </div>
    </section>
  );
}

/**
 * Las preguntas, en lectura, con un atajo al único sitio donde se contestan.
 *
 * Responderlas DENTRO de la interfaz sigue fuera de alcance (spec #1), y esto
 * no lo cambia: «Al árbol» no guarda ninguna respuesta, crea el Nodo con la
 * pregunta y abre el hueco debajo. Es literalmente el paso que la historia 40
 * manda dar —«editar el árbol a mano y regenerar»— sin obligar a memorizar la
 * pregunta, cerrar la hoja y volver a teclearla.
 */
function Questions({ questions }: { questions: string[] }) {
  const { createQuestion } = useTree();

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className={LABEL_CLASS}>{ANALYSIS_COPY.questions}</h2>
        <span className="rounded-full border border-border px-2 py-[3px] text-[9px] tracking-[0.1em] uppercase text-muted-foreground">
          {ANALYSIS_COPY.questionsReadOnly}
        </span>
      </div>

      <ol className="flex flex-col gap-3.5">
        {questions.map((question, index) => (
          <li key={index} className="flex flex-col gap-2">
            <div className="flex gap-2.5">
              <span className="shrink-0 text-xs text-primary">{index + 1}.</span>
              <span className="text-[13px] leading-relaxed text-pretty">
                {question}
              </span>
            </div>
            <button
              type="button"
              onClick={() => fire(createQuestion(question))}
              aria-label={ANALYSIS_COPY.questionToTreeHint(question)}
              className="flex h-9 items-center gap-[7px] self-end rounded-full border border-border px-3.5 text-[10px] tracking-[0.1em] uppercase text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <ToTreeIcon width={14} height={14} />
              {ANALYSIS_COPY.questionToTree}
            </button>
          </li>
        ))}
      </ol>

      <p className="text-[11px] leading-relaxed text-pretty text-muted-foreground">
        {ANALYSIS_COPY.questionsHint}
      </p>
    </section>
  );
}

/**
 * Un bloque del Spec: su etiqueta y su contenido sobre el raíl.
 *
 * El raíl de 1 px a la izquierda marca lo que es MATERIAL DEL PROMPT —texto que
 * va a acabar pegado en un agente— frente al cromo de la app que lo rodea. Es
 * la misma distinción que hace `lib/ai/render.ts` al escribirlo, dicha en
 * píxeles en vez de en saltos de línea.
 */
function SpecBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
        {label}
      </h3>
      <div className="border-l border-edge pl-3 text-[13px] leading-relaxed text-pretty">
        {children}
      </div>
    </div>
  );
}

function SpecList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * El Spec: el porqué antes del qué.
 *
 * Las listas vacías no se pintan. El schema las permite —un `fix` pequeño puede
 * no tener nada fuera de alcance— y una etiqueta con nada debajo se lee como
 * «esto falta» en vez de como «esto no aplica».
 */
function Spec({ spec }: { spec: AnalysisContent["spec"] }) {
  return (
    <section className="flex flex-col gap-[18px] rounded-[20px] border border-border p-[18px]">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        <h2 className={LABEL_CLASS}>{ANALYSIS_COPY.spec}</h2>
      </div>

      <SpecBlock label={ANALYSIS_COPY.specProblem}>{spec.problem}</SpecBlock>
      <SpecBlock label={ANALYSIS_COPY.specSolution}>{spec.solution}</SpecBlock>

      {spec.decisions.length > 0 ? (
        <SpecBlock label={ANALYSIS_COPY.specDecisions}>
          <SpecList items={spec.decisions} />
        </SpecBlock>
      ) : null}
      {spec.testing.length > 0 ? (
        <SpecBlock label={ANALYSIS_COPY.specTesting}>
          <SpecList items={spec.testing} />
        </SpecBlock>
      ) : null}
      {spec.outOfScope.length > 0 ? (
        <SpecBlock label={ANALYSIS_COPY.specOutOfScope}>
          <SpecList items={spec.outOfScope} />
        </SpecBlock>
      ) : null}

      <Checks checks={spec.checks} />
    </section>
  );
}

/**
 * Un Ticket con sus Checks y sus bloqueos.
 *
 * Los bloqueos se nombran por el TÍTULO del Ticket que bloquea, no por su id:
 * «t2» no le dice nada a nadie que no esté contando Tickets a mano. El id se
 * queda al lado porque es lo que el Master Prompt escribe, así que tiene que
 * poder cruzarse con el texto exportado (#17).
 *
 * El índice no puede fallar —el schema rechaza un `blockedBy` que apunte a un
 * Ticket que no existe, y también los ciclos— así que aquí no hay rama para el
 * caso imposible. Esa garantía es un `refine`, no un consejo del prompt.
 */
function TicketCard({
  ticket,
  byId,
}: {
  ticket: Ticket;
  /** El índice ya hecho, de `AnalysisResult`. Solo para nombrar los bloqueos. */
  byId: Map<string, Ticket>;
}) {
  return (
    <article className="flex flex-col gap-3.5 rounded-[20px] border border-border p-[18px]">
      <div className="flex items-baseline gap-2.5">
        <span className="shrink-0 rounded-md border border-border px-[7px] py-[2px] text-[11px] tracking-[0.06em] text-muted-foreground">
          {ticket.id}
        </span>
        <h3 className="text-[15px] leading-snug font-bold text-pretty">
          {ticket.title}
        </h3>
      </div>

      <p className="border-l border-edge pl-3 text-[13px] leading-relaxed text-pretty">
        {ticket.build}
      </p>

      <Checks checks={ticket.checks} />

      {ticket.blockedBy.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <BlockedIcon width={15} height={15} className="shrink-0 text-muted-foreground" />
          <span className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
            {ANALYSIS_COPY.blockedBy}
          </span>
          {ticket.blockedBy.map((id) => (
            <span
              key={id}
              className="rounded-full border border-border px-[9px] py-[3px] text-[11px] text-muted-foreground"
            >
              {ANALYSIS_COPY.blocker(id, byId.get(id)!.title)}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
