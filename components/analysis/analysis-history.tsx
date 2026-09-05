"use client";

import { useState } from "react";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { DeleteAnalysisDialog } from "@/components/analysis/delete-analysis-dialog";
import { analysisWhen, isCurrent } from "@/components/analysis/history";
import { useBlocked } from "@/components/connection/connection-provider";
import { TrashIcon } from "@/components/icons/trash-icon";
import { ICON_BUTTON_CLASS } from "@/components/layout/site-chrome";
import type { Analysis } from "@/lib/backend/ports";
import { ANALYSIS_COPY, CONNECTION_COPY } from "@/lib/constants";

/**
 * El Historial: todos los Análisis de la Versión, del más nuevo al más viejo.
 *
 * ── Por qué se escanea por la Intención y no por la fecha ─────────────────
 *
 * Porque la fecha la tienen todas las filas y no distingue ninguna. La historia
 * 42 dice para qué existe esta lista —«comparar el prompt de ayer con el de
 * hoy»— y lo que de verdad se compara es QUÉ CLASE DE TRABAJO entendió la IA
 * cada vez: un día dedujo `proyecto-nuevo` y al siguiente, con Directrices,
 * `fix`. Por eso la Intención va en NDot y grande, que es como se pinta en el
 * Análisis abierto, y la fecha va debajo en cuerpo de texto.
 *
 * ── Lo que NO se guarda aquí ──────────────────────────────────────────────
 *
 * Nada. La lista es la misma que ya tiene el provider —una sola lectura sirve
 * para las dos caras del panel—, y abrir el Historial no va al motor. Un
 * Análisis nuevo aparece arriba porque `generate` encabeza esa lista, no
 * porque esto vuelva a preguntar.
 */
export function AnalysisHistory() {
  const { analyses, now, select } = useAnalysis();
  /** Cuál se está a punto de borrar. `null` es «ninguno», no «el primero». */
  const [deleting, setDeleting] = useState<Analysis | null>(null);

  if (analyses.length === 0) {
    // Solo se llega aquí borrando el último desde esta misma lista: la puerta
    // no aparece con cero Análisis. Aun así hay que pintar algo, porque quien
    // acaba de borrar sigue mirando la pantalla donde estaba la fila.
    return (
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {ANALYSIS_COPY.historyEmpty}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {analyses.map((analysis) => (
          <HistoryEntry
            key={analysis.id}
            analysis={analysis}
            current={isCurrent(analyses, analysis.id)}
            now={now}
            onOpen={() => select(analysis.id)}
            onDelete={() => setDeleting(analysis)}
          />
        ))}

        <p className="pt-1 text-center text-[11px] leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.historyHint}
        </p>
      </div>

      {deleting ? (
        <DeleteAnalysisDialog analysis={deleting} onClose={() => setDeleting(null)} />
      ) : null}
    </>
  );
}

/**
 * Una fila: qué clase de trabajo, cuándo, cuánto trabajo describe y quién.
 *
 * La tarjeta ENTERA abre el Análisis, y la papelera se superpone en su esquina
 * en vez de ir dentro. No es capricho de maquetación: un `<button>` dentro de
 * otro `<button>` es HTML inválido y los navegadores lo desmontan, así que la
 * única forma de tener una fila tocable con una acción propia es que las dos
 * sean hermanas.
 */
function HistoryEntry({
  analysis,
  current,
  now,
  onOpen,
  onDelete,
}: {
  analysis: Analysis;
  current: boolean;
  /** `null` hasta que la hoja se abre. Ver `now` en el provider. */
  now: Date | null;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const blocked = useBlocked();
  const { content } = analysis;
  const when = analysisWhen(analysis, now);

  return (
    <article
      className={`relative flex flex-col gap-3 rounded-[20px] border p-[18px] transition-colors ${
        current ? "border-primary" : "border-border hover:border-primary"
      }`}
    >
      {/* El relleno derecho le deja sitio a la papelera, que va superpuesta:
          sin él, un título largo pasaría por debajo del icono. */}
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col gap-3 pr-11 text-left"
      >
        <span className="flex items-baseline gap-2.5">
          <span className="font-display text-[24px] leading-none tracking-[0.04em] text-primary">
            {ANALYSIS_COPY.intents[content.intent.kind]}
          </span>
          {current ? (
            <span className="shrink-0 rounded-full bg-primary px-[9px] py-[3px] text-[9px] tracking-[0.1em] uppercase text-primary-foreground">
              {ANALYSIS_COPY.historyCurrent}
            </span>
          ) : null}
        </span>

        <span className="flex flex-col gap-[3px]">
          {/* La fecha calla hasta que hay reloj, en vez de enseñar un hueco:
              es el mismo criterio que la fila de una Versión. */}
          {when ? <span className="text-[13px]">{when}</span> : null}
          <span className="text-[11px] text-muted-foreground">
            {ANALYSIS_COPY.historyEntry(
              content.tickets.length,
              content.questions.length,
              analysis.model,
            )}
          </span>
        </span>
      </button>

      {/* Las Directrices de aquel día, cuando las hubo: es lo que explica por
          qué este Análisis salió distinto del de al lado. En una línea y
          truncadas — aquí no se leen, se reconocen. */}
      {analysis.userGuidelines ? (
        <p className="truncate border-l border-edge pl-3 text-[11px] text-muted-foreground">
          {ANALYSIS_COPY.historyGuidelines(analysis.userGuidelines)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onDelete}
        // Borrar ESCRIBE, así que se apaga sin red como el resto de las
        // mutaciones. Leer y exportar el Historial, no.
        disabled={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
        aria-label={ANALYSIS_COPY.deleteOne(when)}
        // La forma del botón redondo sale de `site-chrome`; lo que se añade es
        // lo que SÍ es de esta fila: dónde va, que nace apagado y que su
        // apagado no responde al ratón.
        className={`${ICON_BUTTON_CLASS} absolute top-[18px] right-[18px] text-muted-foreground disabled:opacity-35 disabled:hover:border-border disabled:hover:text-muted-foreground`}
      >
        <TrashIcon width={17} height={17} />
      </button>
    </article>
  );
}
