"use client";

import { useState } from "react";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { analysisWhen } from "@/components/analysis/history";
import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import type { Analysis } from "@/lib/backend/ports";
import { ANALYSIS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";

/**
 * Borrar un Análisis, con la cuenta de lo que se lleva por delante.
 *
 * Mismo diálogo y mismo criterio que borrar una Versión o podar un Nodo: la
 * cifra grande dice CUÁNTO cae, porque «y todo su contenido» deja a la persona
 * adivinando cuánto es «todo». Aquí lo que cae son los Tickets, que es la
 * unidad de trabajo que alguien podría estar a punto de necesitar.
 *
 * Y dice también lo que NO cae, que es lo que de verdad preocupa: el árbol. Un
 * Análisis sale del árbol y no al revés —la cascada de la migración va en la
 * otra dirección— y quien no lo sepa puede dejar de limpiar por miedo a perder
 * lo que escribió.
 *
 * El diálogo se queda ABIERTO cuando falla, con el motivo dentro. Es lo mismo
 * que hace `DeleteVersionDialog`: cerrarlo dejaría a alguien creyendo que
 * borró algo que sigue ahí.
 */
export function DeleteAnalysisDialog({
  analysis,
  onClose,
}: {
  analysis: Analysis;
  onClose: () => void;
}) {
  // `now` sale del contexto y no de una prop: es el mismo instante que fecha la
  // fila desde la que se pulsó, y este componente ya estaba aquí por `remove`.
  // Pasearlo por la lista solo daba una segunda forma de que las dos fechas
  // discreparan.
  const { remove, now } = useAnalysis();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = useBlocked();

  const when = analysisWhen(analysis, now);
  const tickets = analysis.content.tickets.length;

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await remove(analysis.id);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={ANALYSIS_COPY.deleteLabel}
      title={ANALYSIS_COPY.deleteTitle(when)}
      onClose={onClose}
      closeLabel={ANALYSIS_COPY.close}
    >
      {/* El mismo recuadro de 72 px de las otras dos confirmaciones. La NDot es
          de matriz de puntos y sus cifras ocupan bastante menos alto que su
          `font-size`, así que en línea con una frase se quedaría flotando. */}
      <div className="flex items-center gap-4 rounded-[18px] border border-border p-4">
        <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
          <span className="font-display text-[44px] leading-none text-primary">
            {tickets}
          </span>
          <span className="text-center text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
            {ANALYSIS_COPY.deleteFalls(tickets)}
          </span>
        </div>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.deleteSubtree}
        </p>
      </div>

      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {ANALYSIS_COPY.deleteBody}
      </p>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-[13px] leading-relaxed text-primary"
        >
          <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2.5 pt-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={confirm}
          // La conexión se puede caer con el diálogo ya delante. Ver
          // `DeleteVersionDialog`.
          disabled={pending || blocked}
          className={`${CTA_PRIMARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          <TrashIcon width={18} height={18} />
          {pending ? ANALYSIS_COPY.deleting : ANALYSIS_COPY.deleteSubmit}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${CTA_SECONDARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          {ANALYSIS_COPY.cancel}
        </button>
      </div>
    </Dialog>
  );
}
