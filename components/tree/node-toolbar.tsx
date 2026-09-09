"use client";

import { NodeActions } from "@/components/tree/node-actions";
import { useNodeDialogs } from "@/components/tree/node-dialogs";
import { useTree } from "@/components/tree/tree-provider";

/**
 * La barra del Nodo seleccionado.
 *
 * Existe para que las dos vistas monten UNA cosa y no dos. Antes la pantalla
 * del Registro llevaba el estado de «qué diálogo está delante», la barra y los
 * dos diálogos sueltos; con dos vistas eso serían dos copias del mismo estado,
 * y la que se quedara atrás sería la que nadie mira.
 *
 * Los diálogos salieron de aquí con el mapa de teclado (#42): las teclas los
 * abren igual que los botones, y quien las recibe es la fila del árbol. Viven
 * ahora en `NodeDialogs`, un escalón más arriba, para que las dos vías abran el
 * mismo y no dos.
 */
export function NodeToolbar({
  floating = false,
  className,
}: {
  /** Flotar sobre el lienzo. Lo pide el Canvas; el Registro la quiere en flujo. */
  floating?: boolean;
  className?: string;
}) {
  const tree = useTree();
  const { openMove, openDelete } = useNodeDialogs();

  const selected =
    tree.rows.find((row) => row.node.id === tree.selectedId) ?? null;
  if (!selected) return null;

  return (
    <NodeActions
      row={selected}
      floating={floating}
      className={className}
      onMove={() => openMove(selected.node.id)}
      onDelete={() => openDelete(selected.node.id)}
    />
  );
}
