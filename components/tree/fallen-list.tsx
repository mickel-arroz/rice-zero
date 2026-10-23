"use client";

import { useTree } from "@/components/tree/tree-provider";
import type { TreeNode } from "@/lib/backend/ports";
import { TREE_COPY } from "@/lib/constants";

/** Cuántas bajas se enumeran antes de resumir. Más que esto es una pared. */
const PREVIEW_LIMIT = 6;

/**
 * Las bajas de un borrado, al lado de la cifra grande.
 *
 * Una sola, para podar un Nodo y para la Limpieza: es lo que alguien lee
 * antes de perder trabajo, y dos copias divergen justo ahí. Ver
 * `ConfirmDeleteDialog`. En negrita, cada raíz que se va (`depth` 0); debajo,
 * con su sangría, lo que se lleva.
 */
export function FallenList({ rows }: { rows: { node: TreeNode; depth: number }[] }) {
  const { textOf } = useTree();

  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-0.5">
      {rows.slice(0, PREVIEW_LIMIT).map((row) => (
        <li
          key={row.node.id}
          className={`truncate text-xs ${
            row.depth === 0 ? "font-bold" : "text-muted-foreground"
          }`}
          style={{ paddingLeft: row.depth * 14 }}
        >
          {textOf(row.node).trim() || TREE_COPY.nodePlaceholder}
        </li>
      ))}
      {rows.length > PREVIEW_LIMIT ? (
        <li className="text-xs text-muted-foreground">
          {TREE_COPY.andMore(rows.length - PREVIEW_LIMIT)}
        </li>
      ) : null}
    </ul>
  );
}
