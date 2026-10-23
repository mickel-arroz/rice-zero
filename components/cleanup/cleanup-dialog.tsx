"use client";

import { useMemo } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { FallenList } from "@/components/tree/fallen-list";
import { useTree } from "@/components/tree/tree-provider";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { CLEANUP_COPY } from "@/lib/constants";
import type { CleanupPlan } from "@/lib/tree/cleanup";
import { subtreeRows } from "@/lib/tree/rows";

/**
 * Confirmar la Limpieza con la cifra exacta.
 *
 * El plan llega HECHO: la cifra que se pinta y las raíces que se mandan
 * borrar son el mismo objeto, así que no pueden discrepar (ADR 0007). La
 * anatomía es la del borrado de siempre; la lista, la de podar un Nodo, con
 * una raíz en negrita por cada subárbol que se va.
 */
export function CleanupDialog({
  plan,
  onClose,
}: {
  plan: CleanupPlan;
  onClose: () => void;
}) {
  const { nodes, cleanUp } = useTree();
  const blocked = useBlocked();

  const bajas = useMemo(
    () =>
      plan.roots.flatMap((rootId) => {
        const rows = subtreeRows(nodes, rootId);
        const base = rows[0]?.depth ?? 0;
        return rows.map((row) => ({ node: row.node, depth: row.depth - base }));
      }),
    [nodes, plan.roots],
  );

  return (
    <ConfirmDeleteDialog
      label={CLEANUP_COPY.label}
      title={CLEANUP_COPY.title}
      closeLabel={CLEANUP_COPY.close}
      figure={{
        count: plan.total,
        label: CLEANUP_COPY.falls,
        detail: <FallenList rows={bajas} />,
        // Como al podar: el cuerpo dice qué se va y qué se queda, y debajo la
        // lista. Leer la lista antes de saber qué es no se entiende (el boceto).
        below: true,
      }}
      body={CLEANUP_COPY.body}
      submitLabel={CLEANUP_COPY.submit}
      pendingLabel={CLEANUP_COPY.pending}
      cancelLabel={CLEANUP_COPY.cancel}
      blocked={blocked}
      onConfirm={() => cleanUp(plan)}
      onClose={onClose}
    />
  );
}
