"use client";

import { useState } from "react";

import { DeleteNodeDialog } from "@/components/tree/delete-node-dialog";
import { NodeActions } from "@/components/tree/node-actions";
import { ReparentDialog } from "@/components/tree/reparent-dialog";
import { useTree } from "@/components/tree/tree-provider";

/**
 * La barra del Nodo seleccionado, con los dos diálogos que abre.
 *
 * Existe para que las dos vistas monten UNA cosa y no cuatro. Antes la
 * pantalla del Registro llevaba el estado de «qué diálogo está delante», la
 * barra y los dos diálogos sueltos; con dos vistas eso serían dos copias del
 * mismo estado, y la que se quedara atrás sería la que nadie mira.
 *
 * Los diálogos se pintan mientras haya uno abierto AUNQUE ya no haya Nodo
 * seleccionado: borrar quita la selección, y si dependieran de ella el diálogo
 * se desmontaría a media escritura y el fallo no llegaría a verse.
 */

/** Qué diálogo hay delante, si hay alguno. */
type Overlay = { kind: "move" | "delete"; id: string } | null;

export function NodeToolbar({
  floating = false,
  className,
}: {
  /** Flotar sobre el lienzo. Lo pide el Canvas; el Registro la quiere en flujo. */
  floating?: boolean;
  className?: string;
}) {
  const tree = useTree();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const selected =
    tree.rows.find((row) => row.node.id === tree.selectedId) ?? null;

  // El diálogo se busca en el árbol vivo, no se guarda una copia: así un Nodo
  // que desaparece mientras está abierto lo cierra solo, en vez de dejarlo
  // enseñando algo que ya no existe. Mismo criterio que en `ProjectsScreen`.
  const target = overlay
    ? (tree.nodes.find((node) => node.id === overlay.id) ?? null)
    : null;

  return (
    <>
      {selected ? (
        <NodeActions
          row={selected}
          floating={floating}
          className={className}
          onMove={() => setOverlay({ kind: "move", id: selected.node.id })}
          onDelete={() => setOverlay({ kind: "delete", id: selected.node.id })}
        />
      ) : null}

      {overlay?.kind === "move" && target ? (
        <ReparentDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === "delete" && target ? (
        <DeleteNodeDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
    </>
  );
}
