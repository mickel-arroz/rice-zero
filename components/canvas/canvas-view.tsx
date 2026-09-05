"use client";

import "@xyflow/react/dist/style.css";

import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Edge,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { BlockedIcon } from "@/components/icons/blocked-icon";
import { CollapseIcon } from "@/components/icons/collapse-icon";
import { ExpandIcon } from "@/components/icons/expand-icon";
import { EyeIcon } from "@/components/icons/eye-icon";
import { FitIcon } from "@/components/icons/fit-icon";
import { MinusIcon } from "@/components/icons/minus-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import type { IconComponent } from "@/components/icons/types";
import {
  dropMark,
  dropTargetAt,
  type DropTarget,
  type Point,
} from "@/components/canvas/drop";
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
  type CanvasNodeData,
} from "@/components/canvas/node-view";
import { useDesktop } from "@/components/canvas/use-desktop";
import { fire } from "@/components/tree/fire";
import { NodeToolbar } from "@/components/tree/node-toolbar";
import { useTree } from "@/components/tree/tree-provider";
import { TreeEmpty, TreeError } from "@/components/tree/tree-states";
import { CANVAS_COPY, DOT_PATTERN } from "@/lib/constants";
import { NODE_ERRORS } from "@/lib/services/nodes";
import { layoutForest, treeEdges } from "@/lib/tree/layout";

/**
 * La Vista Canvas: el mismo árbol como diagrama.
 *
 * Aquí no hay lógica de árbol. Las posiciones las calcula `lib/tree/layout`,
 * las escrituras las hace `TreeProvider`, las reglas viven en `lib/tree` y
 * quién es destino válido lo contesta `components/canvas/drop`; esta vista
 * decide QUÉ se enseña en cada estado y se lo pasa al lienzo.
 *
 * ── El layout es siempre automático ───────────────────────────────────────
 *
 * `CONTEXT.md` lo dice y aquí se cumple: la posición de un Nodo NO se guarda
 * ni se toca. El bosque se recoloca entero en cada cambio del árbol.
 *
 * Y por eso ARRASTRAR RE-PARENTA en vez de colocar. El lienzo es controlado:
 * mover un Nodo con el dedo no le cambia la posición, solo AVISA de a dónde
 * ha ido. Esta vista se queda ese aviso en un estado que dura lo que dura el
 * gesto —`Drag`, aquí abajo— y al soltar lo traduce a la única escritura que
 * tiene sentido: colgarlo del Nodo sobre el que se soltó. La posición que
 * tuvo mientras iba en el aire no se persiste ni se puede persistir; el
 * siguiente `layoutForest` la sustituye entera.
 *
 * En móvil no hay arrastre de Nodos (`useDesktop`): ahí el dedo mueve el
 * LIENZO, que es el gesto de una vista que solo se consulta.
 */

/** Fuera del componente: si cambiara en cada render, el lienzo lo advertiría. */
const NODE_TYPES = { [CANVAS_NODE_TYPE]: NodeView };

const VIEWPORT_CLASS =
  "relative flex-1 min-h-[380px] overflow-hidden rounded-[20px] border border-border";

/**
 * Cuánto hay que mover el dedo para que sea un arrastre y no un clic.
 *
 * Por encima del 1 px que trae el lienzo: el cuerpo del Nodo es a la vez el
 * botón que selecciona, el que abre el campo con dos clics y el asa del
 * arrastre. Con un píxel, el temblor de un doble clic empezaba a mover el
 * Nodo entre golpe y golpe.
 */
const DRAG_THRESHOLD = 4;

/** Cómo se agranda y cómo se vuelve. Lo decide `TreeScreen`: el `main` entero
 *  es quien sale del flujo, no solo el lienzo. */
export type FullscreenControl = {
  fullscreen: boolean;
  onFullscreen: () => void;
};

export function CanvasView({ fullscreen, onFullscreen }: FullscreenControl) {
  const tree = useTree();

  if (tree.status === "loading") return <CanvasSkeleton />;
  if (tree.status === "error") return <TreeError />;
  // `readOnlyOnMobile`: en el Canvas de un teléfono no se crea nada, ni
  // siquiera el primer Nodo. Ver el criterio «edición imposible en móvil».
  if (tree.nodes.length === 0) return <TreeEmpty readOnlyOnMobile />;

  return (
    // A pantalla completa el borde y las esquinas sobran: el lienzo ya no está
    // metido en una caja dentro de la página, ES la página.
    <div className={fullscreen ? "relative min-h-0 flex-1" : VIEWPORT_CLASS}>
      {/* El provider se saca FUERA del lienzo a propósito: `useReactFlow` solo
          existe dentro de su contexto, y `Canvas` lo necesita para traducir el
          puntero a coordenadas del bosque mientras se arrastra. `<ReactFlow>`
          reutiliza este contexto en vez de crear otro. */}
      <ReactFlowProvider>
        <Canvas fullscreen={fullscreen} onFullscreen={onFullscreen} />
      </ReactFlowProvider>

      {/* La barra vive DENTRO del lienzo y no en la pantalla: así flota encima
          en vez de robarle alto, y se esconde por debajo de `lg` porque ahí el
          Canvas es solo consulta. */}
      <NodeToolbar floating className="hidden lg:block" />
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

/**
 * El arrastre en curso. Vive lo que dura el gesto y no se persiste jamás.
 *
 * `position` es lo ÚNICO que hace que el Nodo siga al dedo: el lienzo es
 * controlado, así que si esta vista no le devolviera la posición que él mismo
 * acaba de avisar, el Nodo se quedaría clavado en su sitio del layout.
 */
type Drag = {
  id: string;
  position: Point;
  /** Lo que hay debajo del puntero AHORA. Es lo que se pinta como feedback. */
  target: DropTarget | null;
};

/**
 * Un Nodo colocado, sin lo que solo dura un gesto.
 *
 * Es el reparto entre los dos memos escrito como tipo: lo que sale del layout
 * —caro— está aquí, y lo que le falta para ser un `CanvasNode` es exactamente
 * lo que cambia mientras el dedo está abajo.
 */
type Card = Omit<CanvasNode, "data" | "draggable" | "zIndex"> & {
  data: Omit<CanvasNodeData, "drop" | "dragging" | "editable" | "blocked">;
};

/**
 * Dónde está el puntero, venga de un ratón o de un dedo.
 *
 * El lienzo entrega los dos por el mismo callback —y son los eventos del DOM,
 * no los sintéticos de React: el arrastre lo lleva d3 por debajo—, y un
 * `TouchEvent` no tiene `clientX`: lo tienen sus toques. Se mira
 * `changedTouches` primero porque al SOLTAR la lista de toques activos ya está
 * vacía, y soltar es justo el momento en el que se decide el re-parentado.
 *
 * Atender al dedo NO es la «edición táctil del Canvas en móvil» que el spec
 * deja fuera: eso ya lo impide `useDesktop`, que exige `hover: hover`. Lo que
 * queda por esta rama es un escritorio con pantalla táctil, donde el arrastre
 * sí está permitido y el dedo es simplemente el puntero que hay.
 */
function pointerOf(
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null {
  if ("clientX" in event) return event;
  return event.changedTouches[0] ?? event.touches[0] ?? null;
}

function Canvas({ fullscreen, onFullscreen }: FullscreenControl) {
  const tree = useTree();
  const { textOf, nodes: treeNodes, editingId, select, reparent } = tree;
  // `offline` y no `blocked`: en este archivo `blocked` ya es el motivo por el
  // que un destino de arrastre no vale, y dos cosas distintas con el mismo
  // nombre en la misma función es cómo se lee mal un `if`.
  const offline = useBlocked();
  const desktop = useDesktop();
  const { screenToFlowPosition } = useReactFlow();
  const [drag, setDrag] = useState<Drag | null>(null);

  /**
   * Lo caro: colocar el bosque. Solo depende del árbol y de su texto.
   *
   * Separado del memo de abajo a propósito. Aquí dentro está dagre, y un
   * arrastre pinta sesenta fotogramas por segundo: si el resalte del destino
   * viviera en este memo, cada fotograma recolocaría el árbol entero para
   * cambiar un borde de color.
   */
  const { cards, boxes, edges, bounds } = useMemo(() => {
    const parents = new Set(
      treeNodes.map((node) => node.parentId).filter((id) => id !== null),
    );

    const layout = layoutForest(treeNodes, (node) => nodeSize(textOf(node)));
    const byId = new Map(treeNodes.map((node) => [node.id, node]));

    const placed: Card[] = layout.boxes.map((box) => {
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
          // ni suyo (`pointerEvents: 'none'`), y `elementsSelectable` es falso
          // a propósito: quien selecciona son los botones del propio Nodo, no
          // el lienzo. Sin esto, esos botones no se pueden ni pulsar ni
          // sobrevolar — que es justo como se descubrió. El `style` del Nodo se
          // aplica DESPUÉS del suyo, así que gana.
          pointerEvents: "all" as const,
        },
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

    const links: Edge[] = treeEdges(treeNodes).map((edge) => ({
      ...edge,
      style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
    }));

    return {
      cards: placed,
      /** Las cajas tal y como quedaron colocadas: contra esto se acierta el destino. */
      boxes: layout.boxes,
      edges: links,
      // Lo que ocupa el bosque entero. Con esto el encaje no necesita que
      // nadie mida nada en el navegador.
      bounds: { width: layout.width, height: layout.height },
    };
  }, [treeNodes, textOf]);

  /** Lo barato: lo que cambia mientras el dedo está abajo. */
  const nodes: CanvasNode[] = useMemo(
    () =>
      cards.map((card) => {
        const dragging = drag?.id === card.id;
        const aimed = drag?.target?.id === card.id ? drag.target : null;

        return {
          ...card,
          position: dragging ? drag.position : card.position,
          // Se apaga mientras se escribe dentro: con el campo abierto, elegir
          // una palabra con el ratón despegaría el Nodo de su sitio. Y sin red,
          // porque arrastrar aquí ES re-parentar: dejar que el Nodo se mueva
          // bajo el dedo para que después no se guarde sería enseñar un árbol
          // que no existe.
          draggable: desktop && !offline && editingId !== card.id,
          // El que va en el aire pasa por ENCIMA de los que sobrevuela. Sin
          // esto, el destino lo tapaba justo cuando hay que mirarlo.
          zIndex: dragging ? 10 : 0,
          data: {
            ...card.data,
            drop: dropMark(aimed),
            dragging,
            editable: desktop && !offline,
            blocked: offline,
          },
        } satisfies CanvasNode;
      }),
    [cards, drag, desktop, offline, editingId],
  );

  /**
   * Qué hay bajo el puntero, en el árbol. `null` si no se sabe dónde está.
   *
   * Une las dos mitades: `screenToFlowPosition` lleva el píxel de la pantalla
   * a las coordenadas en las que colocó el layout —deshaciendo el zoom y el
   * desplazamiento del lienzo—, y `dropTargetAt` contesta qué Nodo hay ahí.
   */
  const targetUnder = useCallback(
    (event: MouseEvent | TouchEvent, nodeId: string) => {
      const pointer = pointerOf(event);
      if (!pointer) return null;
      const point = screenToFlowPosition({
        x: pointer.clientX,
        y: pointer.clientY,
      });
      return dropTargetAt(treeNodes, boxes, nodeId, point);
    },
    [boxes, screenToFlowPosition, treeNodes],
  );

  const onNodeDragStart = useCallback(
    (_: MouseEvent | TouchEvent, node: CanvasNode) => {
      // Lo que se arrastra queda seleccionado: al soltar, la barra de acciones
      // ya está apuntando al Nodo que se acaba de mover, que es sobre el que
      // se va a seguir trabajando.
      select(node.id);
      setDrag({ id: node.id, position: node.position, target: null });
    },
    [select],
  );

  const onNodeDrag = useCallback(
    (event: MouseEvent | TouchEvent, node: CanvasNode) => {
      setDrag({
        id: node.id,
        position: node.position,
        target: targetUnder(event, node.id),
      });
    },
    [targetUnder],
  );

  const onNodeDragStop = useCallback(
    (event: MouseEvent | TouchEvent, node: CanvasNode) => {
      // El arrastre se cierra SIEMPRE, aunque la escritura falle: el estado
      // solo describe un dedo que ya no está abajo.
      setDrag(null);

      // Se vuelve a preguntar en vez de fiarse de lo último que pintó el
      // fotograma anterior: lo que cuenta es dónde estaba el puntero cuando se
      // soltó, y entre el último `onNodeDrag` y esto cabe un movimiento más.
      const target = targetUnder(event, node.id);

      // Sin destino no pasa nada: soltar sobre el vacío es cancelar. Dejar un
      // Nodo como raíz se pide en «Mover a…», donde se elige a la vista y no
      // por dónde acabó el dedo.
      if (!target || target.rejection !== null) return;
      fire(reparent(node.id, target.id));
    },
    [reparent, targetUnder],
  );

  const blocked = drag?.target?.rejection ?? null;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      // El arrastre de Nodos es la edición de escritorio; en un teléfono el
      // dedo mueve el lienzo. Es la ÚNICA vez que ese límite sale del CSS,
      // porque `nodesDraggable` es una prop y no una clase. Ver `useDesktop`.
      nodesDraggable={desktop}
      nodeDragThreshold={DRAG_THRESHOLD}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      // Nada de esto se toca desde el lienzo: seleccionar y crear los hacen
      // los botones del propio Nodo, que además son botones de verdad y por
      // tanto alcanzables con el teclado.
      nodesConnectable={false}
      nodesFocusable={false}
      elementsSelectable={false}
      edgesFocusable={false}
      // Pan con un dedo y pellizco para acercar: los dos gestos que pide el
      // ticket. `zoomOnDoubleClick` fuera porque el doble clic ya abre el
      // campo de un Nodo, y acercar además sería hacer dos cosas con un gesto.
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

      {/* El porqué del rechazo, mientras el dedo sigue abajo. Va aquí y no
          dentro del Nodo porque una caja de 208 px no aguanta la frase del
          dominio sin recortarla, y un «no puedes» a medias no explica nada.
          El texto sale de `NODE_ERRORS`, donde ya vive: la misma frase que
          lanzaría el servicio si se intentara de verdad. */}
      {blocked ? (
        <Panel position="top-center">
          <span
            role="status"
            className="flex items-center gap-2 rounded-full border border-primary bg-card px-3.5 py-2 text-[11px] text-primary shadow-popover"
          >
            <BlockedIcon width={14} height={14} />
            {NODE_ERRORS[blocked]}
          </span>
        </Panel>
      ) : null}

      <CanvasChrome
        bounds={bounds}
        fullscreen={fullscreen}
        onFullscreen={onFullscreen}
      />
    </ReactFlow>
  );
}

/**
 * Lo que flota sobre el lienzo: el aviso de solo lectura y los controles.
 *
 * Va dentro de `<ReactFlow>` y no fuera porque `useReactFlow` —el mando del
 * zoom— solo existe dentro de su contexto.
 */
function CanvasChrome({
  bounds,
  fullscreen,
  onFullscreen,
}: FullscreenControl & { bounds: Size }) {
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
        {/* Encajar y pantalla completa son cosas DISTINTAS y por eso son dos
            botones: uno mueve la cámara para que quepa el árbol, el otro
            agranda la ventana por la que se mira. */}
        <ZoomButton icon={FitIcon} label={CANVAS_COPY.fit} onClick={fit} />
        <ZoomButton
          icon={fullscreen ? CollapseIcon : ExpandIcon}
          label={fullscreen ? CANVAS_COPY.exitFullscreen : CANVAS_COPY.fullscreen}
          onClick={onFullscreen}
        />
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
