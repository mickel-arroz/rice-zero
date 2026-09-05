"use client";

import { useBlocked } from "@/components/connection/connection-provider";
import { PlusIcon } from "@/components/icons/plus-icon";
import { INDENT, ROW_HEIGHT, NodeRow } from "@/components/registro/node-row";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { TreeEmpty, TreeError } from "@/components/tree/tree-states";
import { CONNECTION_COPY, TREE_COPY } from "@/lib/constants";

/**
 * La Vista Registro: el árbol en filas de texto unidas por líneas, editable
 * solo con botones.
 *
 * Aquí no hay lógica de árbol. La estructura la calcula `lib/tree/rows`, las
 * escrituras las hace `TreeProvider` y las reglas viven en `lib/tree`; esta
 * vista decide QUÉ se enseña en cada estado y nada más.
 *
 * Tampoco tiene cabecera ni barra de acciones: las monta `TreeScreen`, porque
 * las comparte con la Vista Canvas. Lo que queda aquí es lo único que de
 * verdad distingue a esta vista — las filas con sus líneas.
 */

/** La silueta de una fila mientras el árbol viaja. Con su sangría, para que la
 *  forma que aparece sea la forma que se queda. */
function RowSkeleton({ depth }: { depth: number }) {
  return (
    <li className="flex items-stretch" style={{ height: ROW_HEIGHT }}>
      <span className="shrink-0" style={{ width: (depth + 1) * INDENT }} />
      <span className="my-1 flex-1 rounded-2xl bg-accent" />
    </li>
  );
}

export function RegistroView() {
  const tree = useTree();
  const blocked = useBlocked();

  if (tree.status === "loading") {
    return (
      <ul aria-busy="true" aria-label={TREE_COPY.loading} className="flex flex-col">
        {[0, 1, 2, 2, 1, 0].map((depth, index) => (
          <RowSkeleton key={index} depth={depth} />
        ))}
      </ul>
    );
  }

  if (tree.status === "error") return <TreeError />;
  if (tree.rows.length === 0) return <TreeEmpty />;

  return (
    <>
      <ul className="flex flex-col">
        {tree.rows.map((row) => (
          <NodeRow
            key={row.node.id}
            row={row}
            selected={tree.selectedId === row.node.id}
            editing={tree.editingId === row.node.id}
            text={tree.textOf(row.node)}
            blocked={blocked}
            onSelect={() => tree.select(row.node.id)}
            onEdit={() => tree.startEditing(row.node.id)}
            onChange={(value) => tree.setText(row.node.id, value)}
            onStopEditing={tree.stopEditing}
          />
        ))}
      </ul>

      {/* Al final de la lista y no en la cabecera: una raíz nueva se pone la
          última, así que el botón está donde va a aparecer. */}
      <button
        type="button"
        onClick={() => fire(tree.createRoot())}
        disabled={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
        className={`mt-1.5 flex h-12.5 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-[13px] text-muted-foreground transition-colors disabled:opacity-35 ${
          blocked ? "" : "hover:border-primary hover:text-primary"
        }`}
      >
        <PlusIcon width={16} height={16} />
        {TREE_COPY.newRoot}
      </button>
    </>
  );
}
