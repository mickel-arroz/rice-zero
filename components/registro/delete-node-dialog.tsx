"use client";

import { useMemo, useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { useRegistro } from "@/components/registro/registro-provider";
import { Dialog } from "@/components/ui/dialog";
import type { TreeNode } from "@/lib/backend/ports";
import { REGISTRO_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { countDescendants } from "@/lib/tree/model";
import { subtreeRows } from "@/lib/tree/rows";

/**
 * Podar un Nodo, diciendo antes cuánto se va con él.
 *
 * «Borrar con confirmación que indique cuántos descendientes caen» es
 * literalmente el criterio del spec, y el motivo es que el borrado CASCADEA:
 * quien pulsa sobre un Nodo de una línea no tiene por qué acordarse de que
 * debajo colgaba media idea. Por eso además de la cifra se enseña la lista.
 *
 * La cuenta la hace el dominio sobre el árbol que ya está en pantalla: no
 * cuesta una consulta, y es exactamente el mismo recorrido que hará el motor.
 */

/** Cuántas bajas se enumeran antes de resumir. Más que esto es una pared. */
const PREVIEW_LIMIT = 6;

export function DeleteNodeDialog({
  node,
  onClose,
}: {
  node: TreeNode;
  onClose: () => void;
}) {
  const { nodes, remove, textOf } = useRegistro();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las dos cifras salen del MISMO árbol que está en pantalla y del mismo
  // dominio que aplicará el motor: la cuenta no puede discrepar de la lista.
  const total = useMemo(() => countDescendants(nodes, node.id), [nodes, node.id]);
  const subtree = useMemo(() => subtreeRows(nodes, node.id), [nodes, node.id]);
  const base = subtree[0]?.depth ?? 0;

  const title = REGISTRO_COPY.nodeLabel(textOf(node));

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await remove(node.id);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={REGISTRO_COPY.deleteLabel}
      title={REGISTRO_COPY.deleteTitle(title)}
      onClose={onClose}
      closeLabel={REGISTRO_COPY.close}
    >
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {REGISTRO_COPY.deleteBody}
      </p>

      {total > 0 ? (
        <div className="flex items-center gap-4 rounded-[18px] border border-border p-4">
          <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
            <span className="font-display text-[44px] leading-none text-primary">
              {total}
            </span>
            <span className="text-center text-[9px] tracking-[0.1em] uppercase text-muted-foreground">
              {REGISTRO_COPY.deleteFalls(total)}
            </span>
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
            {subtree.slice(0, PREVIEW_LIMIT).map((row) => (
              <li
                key={row.node.id}
                className={`truncate text-xs ${
                  row.node.id === node.id
                    ? "font-bold"
                    : "text-muted-foreground"
                }`}
                style={{ paddingLeft: (row.depth - base) * 14 }}
              >
                {textOf(row.node).trim() || REGISTRO_COPY.nodePlaceholder}
              </li>
            ))}
            {subtree.length > PREVIEW_LIMIT ? (
              <li className="text-xs text-muted-foreground">
                {REGISTRO_COPY.andMore(subtree.length - PREVIEW_LIMIT)}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

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
          onClick={() => void confirm()}
          disabled={pending}
          className={`${CTA_PRIMARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          <TrashIcon width={18} height={18} />
          {REGISTRO_COPY.deleteSubmit}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${CTA_SECONDARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          {REGISTRO_COPY.cancel}
        </button>
      </div>
    </Dialog>
  );
}
