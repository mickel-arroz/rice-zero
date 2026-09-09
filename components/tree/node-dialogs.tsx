"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { DeleteNodeDialog } from "@/components/tree/delete-node-dialog";
import { ReparentDialog } from "@/components/tree/reparent-dialog";
import { useTree } from "@/components/tree/tree-provider";

/**
 * Los dos diálogos que se abren sobre un Nodo, y quién está delante.
 *
 * Vivía dentro de `NodeToolbar`, que era su único llamante. Salió de allí al
 * llegar el mapa de teclado (#42): `Mod+Shift+←` y `Mod+Retroceso` piden
 * exactamente lo mismo que los botones «Mover a…» y «Borrar», y quien recibe
 * esas pulsaciones es la FILA del árbol, que está en otra rama del componente y
 * no podía alcanzar aquel estado.
 *
 * Las dos vías tienen que abrir el MISMO diálogo, no dos copias: dos estados de
 * «qué hay delante» acaban con dos diálogos superpuestos el día que alguien
 * pulse el botón con la tecla ya apretada.
 *
 * Es estado de la PANTALLA y por eso no está en `TreeProvider`: aquél guarda el
 * árbol y lo que se le escribe, y qué diálogo está abierto no es ninguna de las
 * dos cosas. Misma frontera que ya tenía `NodeActions` con sus dos callbacks.
 *
 * Los diálogos se pintan mientras haya uno abierto AUNQUE ya no haya Nodo
 * seleccionado: borrar quita la selección, y si dependieran de ella el diálogo
 * se desmontaría a media escritura y el fallo no llegaría a verse.
 */

/** Qué diálogo hay delante, si hay alguno. */
type Overlay = { kind: "move" | "delete"; id: string } | null;

type NodeDialogsValue = {
  /** Abre «Mover a…» sobre ese Nodo. */
  openMove(nodeId: string): void;
  /** Abre la confirmación de borrado sobre ese Nodo. */
  openDelete(nodeId: string): void;
};

const NodeDialogsContext = createContext<NodeDialogsValue | null>(null);

export function NodeDialogs({ children }: { children: React.ReactNode }) {
  const tree = useTree();
  const [overlay, setOverlay] = useState<Overlay>(null);

  // El Nodo se busca en el árbol vivo, no se guarda una copia: así uno que
  // desaparece mientras está abierto cierra el diálogo solo, en vez de dejarlo
  // enseñando algo que ya no existe. Mismo criterio que en `ProjectsScreen`.
  const target = overlay
    ? (tree.nodes.find((node) => node.id === overlay.id) ?? null)
    : null;

  const value = useMemo<NodeDialogsValue>(
    () => ({
      openMove: (nodeId) => setOverlay({ kind: "move", id: nodeId }),
      openDelete: (nodeId) => setOverlay({ kind: "delete", id: nodeId }),
    }),
    [],
  );

  return (
    <NodeDialogsContext.Provider value={value}>
      {children}

      {overlay?.kind === "move" && target ? (
        <ReparentDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === "delete" && target ? (
        <DeleteNodeDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
    </NodeDialogsContext.Provider>
  );
}

/**
 * @throws si se usa fuera de la pantalla del árbol. Deliberado, igual que
 * `useTree`: un botón que ofrece borrar y no puede abrir la confirmación no
 * tiene un estado degradado sensato — borraría sin preguntar o no haría nada.
 */
export function useNodeDialogs(): NodeDialogsValue {
  const value = useContext(NodeDialogsContext);
  if (!value) {
    throw new Error("useNodeDialogs necesita estar dentro de <NodeDialogs>.");
  }
  return value;
}
