"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { PlusIcon } from "@/components/icons/plus-icon";
import { CANVAS_NODE } from "@/components/canvas/geometry";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { CANVAS_COPY, TREE_COPY } from "@/lib/constants";

/**
 * Un Nodo dibujado en el lienzo.
 *
 * Es a la Vista Canvas lo que `NodeRow` es a la Vista Registro, y reproduce su
 * vocabulario en vez de inventar otro: punto rojo de 8 px en una raíz, punto
 * de 6 px del color del enlace en un subnodo, borde rojo en el seleccionado y
 * el mismo marcador gris cuando todavía no hay texto. Es el MISMO árbol: si
 * aquí una raíz se dibujara distinto, habría que aprenderse dos idiomas para
 * leer una sola idea.
 *
 * Lo que lee del provider —y no de sus props— es la selección. Así seleccionar
 * no obliga a recalcular el bosque entero: cambia el contexto y se repintan
 * los Nodos, pero las posiciones siguen siendo las mismas.
 */

/**
 * La clave con la que el lienzo reconoce a este componente.
 *
 * Constante y no el literal `"tree"` repetido en tres sitios: el lienzo NO
 * avisa de un tipo que no conoce, simplemente pinta su Nodo por defecto.
 */
export const CANVAS_NODE_TYPE = "tree";

export type CanvasNodeData = {
  nodeId: string;
  /** El texto que se enseña: el borrador si lo hay, si no lo guardado. */
  text: string;
  /** Las líneas que ocupa. El texto se recorta justo ahí. */
  lines: number;
  isRoot: boolean;
  hasChildren: boolean;
};

export type CanvasNode = Node<CanvasNodeData, typeof CANVAS_NODE_TYPE>;

/** El punto de entrada y el de salida. Va en `style` porque el lienzo trae los suyos. */
function pinStyle(highlight: boolean) {
  return {
    width: 6,
    height: 6,
    minWidth: 6,
    minHeight: 6,
    border: "none",
    background: highlight ? "var(--primary)" : "var(--edge-color)",
  };
}

export function NodeView({ data }: NodeProps<CanvasNode>) {
  const tree = useTree();
  const selected = tree.selectedId === data.nodeId;
  const empty = data.text.trim().length === 0;
  const named = TREE_COPY.nodeLabel(data.text);

  return (
    <div className="group relative size-full">
      {/* Una raíz no cuelga de nadie, así que su punto no es un conector: es
          un adorno, y por eso es un `span` y no un `Handle`. Un conector sin
          enlace que llegue solo sirve para que el lienzo se pregunte por él. */}
      {data.isRoot ? (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={false}
          style={pinStyle(selected)}
        />
      )}

      <button
        type="button"
        onClick={() => tree.select(data.nodeId)}
        aria-label={TREE_COPY.select(named)}
        aria-pressed={selected}
        className={`size-full rounded-2xl border bg-node-bg px-3.5 text-left transition-colors ${
          selected
            ? "border-primary text-primary"
            : "border-border hover:border-primary"
        }`}
        style={{ paddingBlock: CANVAS_NODE.padding / 2 }}
      >
        {/* El recorte usa EXACTAMENTE las líneas con las que se colocó el
            Nodo: si dibujara una más, se saldría de su caja y se comería a su
            hermano de abajo. Ver `components/canvas/geometry.ts`. */}
        <span
          className={`overflow-hidden text-[13px] break-words ${
            empty ? "text-muted-foreground" : ""
          }`}
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: data.lines,
            lineHeight: `${CANVAS_NODE.lineHeight}px`,
          }}
        >
          {empty ? TREE_COPY.nodePlaceholder : data.text}
        </span>
      </button>

      {data.hasChildren ? (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          style={pinStyle(selected)}
        />
      ) : null}

      {/* El «+» nace donde arrancan las líneas de los subnodos: el punto de
          salida crece de 6 a 24 px. Y solo con ratón — `lg:` y `hover` — que
          es exactamente lo que hace que en el móvil el Canvas siga siendo solo
          consulta, sin una bandera que alguien pueda poner al revés.

          Se apaga con `opacity` y NO con `invisible`, aunque un botón
          transparente se siga pulsando: lo invisible tampoco se puede ENFOCAR,
          así que con `invisible` el «+» no existía para el teclado. Se apaga
          la opacidad y se quita el ratón por separado, y el foco lo devuelve
          entero — que es como se llega aquí tabulando desde el propio Nodo. */}
      <button
        type="button"
        onClick={() => fire(tree.createChild(data.nodeId))}
        aria-label={CANVAS_COPY.addChild(named)}
        className="absolute top-1/2 right-0 z-10 hidden size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-card text-primary opacity-0 shadow-popover transition-opacity lg:pointer-events-none lg:flex lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:focus-visible:pointer-events-auto lg:focus-visible:opacity-100"
      >
        <PlusIcon width={14} height={14} />
      </button>
    </div>
  );
}
