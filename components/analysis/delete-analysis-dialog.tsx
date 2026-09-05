"use client";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { analysisWhen } from "@/components/analysis/history";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { Analysis } from "@/lib/backend/ports";
import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * Borrar un Análisis, con la cuenta de lo que se lleva por delante.
 *
 * Mismo diálogo —literalmente el mismo, `ConfirmDeleteDialog`— y mismo criterio
 * que borrar una Versión o podar un Nodo: la cifra grande dice CUÁNTO cae,
 * porque «y todo su contenido» deja a la persona adivinando cuánto es «todo».
 * Aquí lo que cae son los Tickets, que es la unidad de trabajo que alguien
 * podría estar a punto de necesitar.
 *
 * Y dice también lo que NO cae, que es lo que de verdad preocupa: el árbol. Un
 * Análisis sale del árbol y no al revés —la cascada de la migración va en la
 * otra dirección— y quien no lo sepa puede dejar de limpiar por miedo a perder
 * lo que escribió.
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

  const when = analysisWhen(analysis, now);
  const tickets = analysis.content.tickets.length;

  return (
    <ConfirmDeleteDialog
      label={ANALYSIS_COPY.deleteLabel}
      title={ANALYSIS_COPY.deleteTitle(when)}
      closeLabel={ANALYSIS_COPY.close}
      // Sin `null`: un Análisis sin Tickets sigue enseñando el cero, porque el
      // cero es justo la noticia que hace que borrarlo salga barato.
      count={tickets}
      countLabel={ANALYSIS_COPY.deleteFalls}
      detail={ANALYSIS_COPY.deleteSubtree}
      body={ANALYSIS_COPY.deleteBody}
      submitLabel={ANALYSIS_COPY.deleteSubmit}
      pendingLabel={ANALYSIS_COPY.deleting}
      cancelLabel={ANALYSIS_COPY.cancel}
      onConfirm={() => remove(analysis.id)}
      onClose={onClose}
    />
  );
}
