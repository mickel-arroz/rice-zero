"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  useReactFlow,
  useStore,
  type Edge,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { EyeIcon } from "@/components/icons/eye-icon";
import { FitIcon } from "@/components/icons/fit-icon";
import { MinusIcon } from "@/components/icons/minus-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import type { IconComponent } from "@/components/icons/types";
import {
  CANVAS_ZOOM,
  fitViewport,
  nodeLines,
  nodeSize,
  type Size,
} from "@/components/canvas/geometry";
import {
  CANVAS_NODE_TYPE,
  NodeView,
  type CanvasNode,
} from "@/components/canvas/node-view";
import { useTree } from "@/components/tree/tree-provider";
import { TreeEmpty, TreeError } from "@/components/tree/tree-states";
import { CANVAS_COPY, DOT_PATTERN } from "@/lib/constants";
import { layoutForest, treeEdges } from "@/lib/tree/layout";

/**
 * La Vista Canvas: el mismo árbol como diagrama.
 *
 * Aquí no hay lógica de árbol. Las posiciones las calcula `lib/tree/layout`,
 * las escrituras las hace `TreeProvider` y las reglas viven en `lib/tree`;
 * esta vista decide QUÉ se enseña en cada estado y se lo pasa al lienzo.
 *
 * ── El layout es siempre automático ───────────────────────────────────────
 *
 * `CONTEXT.md` lo dice y aquí se cumple de la única forma en que se puede
 * cumplir: la posición de un Nodo NO se guarda ni se toca. El bosque se
 * recoloca entero en cada cambio del árbol, y por eso el lienzo va con
 * `nodesDraggable={false}` — arrastrar un Nodo no puede «colocarlo» en ningún
 * sitio, porque el siguiente recálculo lo devolvería a donde toca.
 * Arrastrar sirve para mover el LIENZO, que es lo que se hace con el dedo.
 */

/** Fuera del componente: si cambiara en cada render, el lienzo lo advertiría. */
const NODE_TYPES = { [CANVAS_NODE_TYPE]: NodeView };

const VIEWPORT_CLASS =
  "relative flex-1 min-h-[380px] overflow-hidden rounded-[20px] border border-border";

export function CanvasView() {
  const tree = useTree();

  if (tree.status === "loading") return <CanvasSkeleton />;
  if (tree.status === "error") return <TreeError />;
  // `readOnlyOnMobile`: en el Canvas de un teléfono no se crea nada, ni
  // siquiera el primer Nodo. Ver el criterio «edición imposible en móvil».
  if (tree.nodes.length === 0) return <TreeEmpty readOnlyOnMobile />;

  return (
    <div className={VIEWPORT_CLASS}>
      <Canvas />
    </div>
  );
}

/** La silueta mientras el árbol viaja: la caja que va a ocupar, y nada más. */
function CanvasSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={CANVAS_COPY.loading}
      className={`${VIEWPORT_CLASS} bg-accent/40`}
    />
  );
}

function Canvas() {
  const tree = useTree();
  const { textOf } = tree;

  const { nodes, edges, bounds } = useMemo(() => {
    const parents = new Set(
      tree.nodes.map((node) => node.parentId).filter((id) => id !== null),
    );

    const layout = layoutForest(tree.nodes, (node) => nodeSize(textOf(node)));
    const byId = new Map(tree.nodes.map((node) => [node.id, node]));

    const placed: CanvasNode[] = layout.boxes.map((box) => {
      // `layoutForest` promete colocar a TODOS, así que este Nodo existe.
      const node = byId.get(box.id)!;
      const text = textOf(node);

      return {
        id: box.id,
        type: CANVAS_NODE_TYPE,
        position: { x: box.x, y: box.y },
        style: {
          // Del tamaño con el que se colocó, no del que le salga al texto: la
          // caja del lienzo y la caja del layout tienen que ser la misma.
          width: box.width,
          height: box.height,
          // El lienzo APAGA el ratón sobre un Nodo que no es ni seleccionable
          // ni arrastrable ni suyo (`pointerEvents: 'none'`), y aquí los dos
          // son falsos a propósito: quien selecciona y quien crea son botones
          // del propio Nodo, no el lienzo. Sin esto, esos botones no se pueden
          // ni pulsar ni sobrevolar — que es justo como se descubrió. El
          // `style` del Nodo se aplica DESPUÉS del suyo, así que gana.
          pointerEvents: "all" as const,
        },
        draggable: false,
        selectable: false,
        data: {
          nodeId: box.id,
          text,
          lines: nodeLines(text),
          isRoot: node.parentId === null,
          hasChildren: parents.has(box.id),
        },
      };
    });

    const links: Edge[] = treeEdges(tree.nodes).map((edge) => ({
      ...edge,
      style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
    }));

    return {
      nodes: placed,
      edges: links,
      // Lo que ocupa el bosque entero. Con esto el encaje no necesita que
      // nadie mida nada en el navegador.
      bounds: { width: layout.width, height: layout.height },
    };
  }, [tree.nodes, textOf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      // Nada de esto se toca desde el lienzo: seleccionar y crear los hacen
      // los botones del propio Nodo, que además son botones de verdad y por
      // tanto alcanzables con el teclado.
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      // Pan con un dedo y pellizco para acercar: los dos gestos que pide el
      // ticket. `zoomOnDoubleClick` fuera porque el doble toque en un Nodo
      // acabaría acercando en vez de hacer nada.
      panOnDrag
      zoomOnPinch
      zoomOnDoubleClick={false}
      // Sin `fitView`: el encaje lo calcula `fitViewport` con las medidas que
      // ya dio el layout, en vez de esperar a que el lienzo mida los Nodos.
      minZoom={CANVAS_ZOOM.min}
      maxZoom={CANVAS_ZOOM.max}
      attributionPosition="bottom-left"
      aria-label={CANVAS_COPY.canvasLabel}
      style={{ background: "transparent" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={DOT_PATTERN.gap}
        size={1.5}
        color="var(--dot-base)"
        style={{ opacity: DOT_PATTERN.restOpacity }}
      />
      <CanvasChrome bounds={bounds} />
    </ReactFlow>
  );
}

/**
 * Lo que flota sobre el lienzo: el aviso de solo lectura y el zoom.
 *
 * Va dentro de `<ReactFlow>` y no fuera porque `useReactFlow` —el mando del
 * zoom— solo existe dentro de su contexto.
 */
function CanvasChrome({ bounds }: { bounds: Size }) {
  const { setViewport, zoomIn, zoomOut } = useReactFlow();

  // Dos selectores y no uno que devuelva un objeto: el store compara por
  // identidad, y un objeto nuevo en cada llamada repintaría sin parar.
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);

  /** Ya se abrió. Reencajar en cada cambio movería el suelo al crear un Nodo. */
  const opened = useRef(false);

  const fit = useCallback(() => {
    if (paneWidth === 0 || paneHeight === 0) return;
    void setViewport(
      fitViewport(bounds, { width: paneWidth, height: paneHeight }),
    );
  }, [bounds, paneHeight, paneWidth, setViewport]);

  useEffect(() => {
    // El lienzo aún no se ha medido: en el primer render su caja es de cero.
    if (opened.current || paneWidth === 0 || paneHeight === 0) return;
    opened.current = true;
    fit();
  }, [fit, paneHeight, paneWidth]);

  return (
    <>
      {/* Solo por debajo de `lg`, que es donde la barra de acciones no se
          monta: sin este aviso, un Nodo resaltado y ningún botón parecería que
          la pantalla se ha quedado a medias. */}
      <Panel position="top-left" className="lg:hidden">
        <span
          title={CANVAS_COPY.readOnlyHint}
          className="flex h-8 items-center gap-2 rounded-full border border-border bg-card px-3 text-[11px] text-muted-foreground"
        >
          <EyeIcon width={14} height={14} />
          {CANVAS_COPY.readOnly}
        </span>
      </Panel>

      <Panel position="bottom-right" className="flex flex-col gap-2">
        <ZoomButton icon={PlusIcon} label={CANVAS_COPY.zoomIn} onClick={() => zoomIn()} />
        <ZoomButton icon={MinusIcon} label={CANVAS_COPY.zoomOut} onClick={() => zoomOut()} />
        <ZoomButton icon={FitIcon} label={CANVAS_COPY.fit} onClick={fit} />
      </Panel>
    </>
  );
}

/**
 * Un botón del lienzo: 44 px en táctil, 36 en escritorio.
 *
 * Los 44 no son decorativos: en el móvil éstos son los ÚNICOS controles del
 * Canvas, y se pulsan con el pulgar sobre un lienzo que se mueve.
 */
function ZoomButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-popover transition-colors hover:border-primary hover:text-primary lg:size-9"
    >
      <Icon width={18} height={18} />
    </button>
  );
}
