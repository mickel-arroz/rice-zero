"use client";

import { useMemo } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { useTree } from "@/components/tree/tree-provider";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { TreeNode } from "@/lib/backend/ports";
import { TREE_COPY } from "@/lib/constants";
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
 *
 * La anatomía la pone `ConfirmDeleteDialog`; lo de aquí es la lista y el orden.
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
  const { nodes, remove, textOf } = useTree();
  const blocked = useBlocked();

  // Las dos cifras salen del MISMO árbol que está en pantalla y del mismo
  // dominio que aplicará el motor: la cuenta no puede discrepar de la lista.
  const total = useMemo(() => countDescendants(nodes, node.id), [nodes, node.id]);
  const subtree = useMemo(() => subtreeRows(nodes, node.id), [nodes, node.id]);
  const base = subtree[0]?.depth ?? 0;

  const title = TREE_COPY.nodeLabel(textOf(node));

  /** Las bajas, con su sangría relativa al Nodo que se poda. */
  const bajas = (
    <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
      {subtree.slice(0, PREVIEW_LIMIT).map((row) => (
        <li
          key={row.node.id}
          className={`truncate text-xs ${
            row.node.id === node.id ? "font-bold" : "text-muted-foreground"
          }`}
          style={{ paddingLeft: (row.depth - base) * 14 }}
        >
          {textOf(row.node).trim() || TREE_COPY.nodePlaceholder}
        </li>
      ))}
      {subtree.length > PREVIEW_LIMIT ? (
        <li className="text-xs text-muted-foreground">
          {TREE_COPY.andMore(subtree.length - PREVIEW_LIMIT)}
        </li>
      ) : null}
    </ul>
  );

  return (
    <ConfirmDeleteDialog
      label={TREE_COPY.deleteLabel}
      title={TREE_COPY.deleteTitle(title)}
      closeLabel={TREE_COPY.close}
      // Un Nodo sin subnodos no se lleva nada por delante: no hay cifra que dar.
      figure={
        total === 0
          ? undefined
          : {
              count: total,
              label: TREE_COPY.deleteFalls,
              detail: bajas,
              // El cuerpo ya dice qué se lleva; aquí va la lista de las bajas.
              below: true,
            }
      }
      body={TREE_COPY.deleteBody}
      submitLabel={TREE_COPY.deleteSubmit}
      pendingLabel={TREE_COPY.deleting}
      cancelLabel={TREE_COPY.cancel}
      blocked={blocked}
      onConfirm={() => remove(node.id)}
      onClose={onClose}
    />
  );
}
