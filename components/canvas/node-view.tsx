"use client";

import { useEffect, useRef } from "react";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { BlockedIcon } from "@/components/icons/blocked-icon";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import type { DropMark } from "@/components/canvas/drop";
import { CANVAS_NODE } from "@/components/canvas/geometry";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { STRUCK_CLASS } from "@/components/layout/site-chrome";
import { CANVAS_COPY, CONNECTION_COPY, TREE_COPY } from "@/lib/constants";

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
 * Lo que lee del provider —y no de sus props— es la selección y el campo
 * abierto. Así seleccionar o teclear no obliga a recalcular el bosque entero:
 * cambia el contexto y se repintan los Nodos.
 *
 * ── Qué se puede hacer aquí y con qué gesto ───────────────────────────────
 *
 * Un clic selecciona. Un doble clic abre el campo. El «+» de la esquina
 * inferior derecha cuelga un subnodo, y el chevrón del borde derecho pliega el
 * subárbol. Arrastrar el cuerpo lo re-parenta — eso lo lleva
 * `canvas-view.tsx`, que es quien conoce el bosque entero. Borrar NO está
 * aquí: lo hace la barra de acciones, que ya flota sobre el lienzo con su
 * confirmación, y un botón de borrar sobre la misma superficie que se arrastra
 * es un accidente esperando a pasar.
 *
 * Todo eso solo en escritorio y con red (`data.editable`). En un teléfono el
 * Canvas es consulta y el cuerpo del Nodo solo selecciona; sin conexión, lo
 * mismo en los dos formatos. El plegado es la excepción, y por eso está: no
 * escribe nada —vive en el navegador de quien mira— así que sigue funcionando
 * en el teléfono y sin red, que es justo cuando un árbol grande más estorba.
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
  /** Su subárbol está doblado: aquí, además, no se dibuja. */
  collapsed: boolean;
  /**
   * Se pinta tachado: está completado, o lo está alguno de sus antepasados.
   *
   * Llega HECHO desde el lienzo y no se deduce aquí: la regla es del árbol
   * —hace falta el camino hasta la raíz— y ya la resolvió `treeRows`.
   */
  struck: boolean;
  /** Este Nodo es el destino bajo el puntero, y si vale. `null`: no lo es. */
  drop: DropMark | null;
  /** Este es el Nodo que va en el aire. */
  dragging: boolean;
  /**
   * Se puede arrastrar, abrir el campo y colgar un subnodo.
   *
   * Escritorio Y con red (ver `useDesktop` y `useBlocked`): las dos cosas
   * apagan los mismos gestos, y por motivos distintos —en el teléfono el
   * Canvas es consulta; sin conexión no se escribe en ningún sitio—. Van
   * juntas en una sola bandera porque quien la lee solo pregunta «¿puedo?».
   */
  editable: boolean;
  /**
   * No hay red.
   *
   * Aparte de `editable` y no deducido de ella porque el campo ABIERTO es el
   * único gesto cuyos dos motivos no coinciden: en un teléfono se puede llegar
   * aquí con un Nodo abierto desde la Vista Registro, y ahí lo escrito tiene
   * que seguir aceptando teclas mientras haya conexión.
   */
  blocked: boolean;
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

/**
 * El borde de la caja según lo que le esté pasando.
 *
 * La paleta de la app tiene UN acento y no tiene verde, así que «vale» y «no
 * vale» no pueden ser dos colores. Se distinguen por peso: el destino que vale
 * se enciende entero —borde de acento y fondo resaltado, como el Nodo
 * seleccionado—, y el que no vale se apaga y se puntea. Apagarlo y marcarlo
 * con `BlockedIcon` es lo que ya hace `ReparentDialog` con sus destinos
 * bloqueados: un solo idioma para «aquí no» en las dos formas de mover un
 * Nodo. El borde punteado lo añade esta vista, porque aquí no hay una fila
 * con sitio para escribir el motivo al lado.
 */
function boxClass(drop: DropMark | null, selected: boolean): string {
  if (drop === "valid") return "border-primary bg-accent text-primary";
  if (drop === "blocked") {
    return "border-dashed border-muted-foreground bg-node-bg opacity-45";
  }
  return selected
    ? "border-primary bg-node-bg text-primary"
    : "border-border bg-node-bg hover:border-primary";
}

export function NodeView({ data }: NodeProps<CanvasNode>) {
  const tree = useTree();
  const selected = tree.selectedId === data.nodeId;
  const editing = tree.editingId === data.nodeId;
  const empty = data.text.trim().length === 0;
  const named = TREE_COPY.nodeLabel(data.text);

  const area = useRef<HTMLTextAreaElement>(null);

  // Al abrir el campo, el cursor va al final y no al principio: se entra a
  // seguir escribiendo mucho más a menudo que a corregir la primera palabra.
  // Mismo criterio que `NodeRow`; lo que aquí NO se hace es estirar la caja
  // con el texto, porque el alto lo fija el layout y estirarla la sacaría de
  // su sitio. Ver el recorte a `maxLines` de `geometry.ts`.
  useEffect(() => {
    if (!editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  return (
    <div
      className={`group relative size-full ${data.dragging ? "opacity-80" : ""} ${
        data.drop === "blocked" ? "cursor-not-allowed" : ""
      }`}
    >
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
          style={pinStyle(selected || data.drop === "valid")}
        />
      )}

      {editing ? (
        // `nodrag` y `nopan`: sin ellos, seleccionar texto con el ratón
        // arrastraría el Nodo o el lienzo entero. `nowheel` deja que la rueda
        // recorra el campo en vez de acercar el diagrama — hace falta porque
        // la caja está recortada a `maxLines` y un texto más largo se lee
        // dentro, desplazándolo.
        <textarea
          ref={area}
          value={data.text}
          onChange={(event) => tree.setText(data.nodeId, event.target.value)}
          onBlur={tree.stopEditing}
          // Escape cierra el campo pero NO deselecciona: lo más probable
          // después de escribir es querer moverlo o colgarle un subnodo, y eso
          // lo hace la barra, que necesita el Nodo seleccionado. Igual que en
          // la Vista Registro.
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              tree.stopEditing();
            }
          }}
          placeholder={TREE_COPY.nodePlaceholder}
          aria-label={TREE_COPY.edit(named)}
          // `readOnly` y no `disabled`, por lo mismo que en `NodeRow`: lo que
          // se bloquea es escribir, no leer ni copiar lo que ya hay dentro.
          readOnly={data.blocked}
          title={data.blocked ? CONNECTION_COPY.blocked : undefined}
          className="nodrag nopan nowheel size-full resize-none rounded-2xl border border-primary bg-node-bg px-3.5 text-[13px] break-words outline-none placeholder:text-muted-foreground"
          style={{
            paddingBlock: CANVAS_NODE.padding / 2,
            lineHeight: `${CANVAS_NODE.lineHeight}px`,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => tree.select(data.nodeId)}
          // Doble clic, y no «el segundo clic sobre el ya seleccionado» que es
          // lo que hace la Vista Registro: aquí el cuerpo del Nodo es el asa
          // del arrastre, y un arrastre que acaba encima del Nodo del que
          // salió dispara `click` igualmente. Con la regla del Registro, cada
          // arrastre cancelado abriría el campo.
          onDoubleClick={
            data.editable ? () => tree.startEditing(data.nodeId) : undefined
          }
          title={data.editable ? CANVAS_COPY.editHint : undefined}
          aria-label={TREE_COPY.select(named)}
          aria-pressed={selected}
          className={`size-full rounded-2xl border px-3.5 text-left transition-colors ${boxClass(
            data.drop,
            selected,
          )}`}
          style={{ paddingBlock: CANVAS_NODE.padding / 2 }}
        >
          {/* El recorte usa EXACTAMENTE las líneas con las que se colocó el
              Nodo: si dibujara una más, se saldría de su caja y se comería a
              su hermano de abajo. Ver `components/canvas/geometry.ts`. */}
          <span
            className={`overflow-hidden text-[13px] break-words ${
              data.struck ? STRUCK_CLASS : empty ? "text-muted-foreground" : ""
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
      )}

      {/* El punto de salida solo existe si de él sale una línea. Plegado no
          sale ninguna, así que el conector se retira y su sitio queda para el
          botón de desplegar — igual que en la Vista Registro, donde el punto y
          el botón comparten exactamente el mismo centro. */}
      {data.hasChildren && !data.collapsed ? (
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={false}
          style={pinStyle(selected)}
        />
      ) : null}

      {/* Plegar, en el mismo sitio del que salen los hijos.

          SIEMPRE visible, al revés que el «+»: plegar es consulta, no
          escritura, así que funciona también en el teléfono —donde el Canvas
          es solo de lectura— y sin conexión. Por eso también se lleva el
          ancla del borde derecho y el «+» se aparta abajo: lo permanente se
          queda con el sitio bueno y lo que solo aparece al pasar el ratón cede.

          `nodrag` porque vive sobre el asa del arrastre. */}
      {data.hasChildren ? (
        <button
          type="button"
          onClick={() => tree.toggleCollapsed(data.nodeId)}
          aria-expanded={!data.collapsed}
          aria-label={
            data.collapsed ? TREE_COPY.expand(named) : TREE_COPY.collapse(named)
          }
          className={`nodrag absolute top-1/2 right-0 z-10 flex size-[18px] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary hover:text-primary ${
            selected ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {data.collapsed ? (
            <ChevronRightIcon width={12} height={12} />
          ) : (
            <ChevronDownIcon width={12} height={12} />
          )}
        </button>
      ) : null}

      {/* La marca de «aquí no», encima del propio destino. El PORQUÉ lo dice
          el aviso del lienzo, que sí tiene ancho para la frase del dominio;
          esto solo señala cuál de todos los Nodos es el que la provoca. */}
      {data.drop === "blocked" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-card text-primary shadow-popover"
        >
          <BlockedIcon width={16} height={16} />
        </span>
      ) : null}

      {/* El «+» va a la ESQUINA inferior derecha: hacia donde crecen los
          subnodos, pero fuera del borde derecho, que desde #45 es del botón de
          plegar. Nació sobre el punto de salida —«el punto crece de 6 a 24»— y
          se movió cuando ese punto pasó a tener dueño permanente: dos botones
          en la misma coordenada, uno visible siempre y otro solo al pasar por
          encima, es un clic que hace lo que no se pidió.

          Una esquina y no «a veces aquí, a veces allá» según tenga hijos: un
          botón que cambia de sitio no se aprende.

          Y solo con ratón — `lg:` y `hover` — que es exactamente lo que hace
          que en el móvil el Canvas siga siendo solo consulta, sin una bandera
          que alguien pueda poner al revés.

          Se apaga con `opacity` y NO con `invisible`, aunque un botón
          transparente se siga pulsando: lo invisible tampoco se puede ENFOCAR,
          así que con `invisible` el «+» no existía para el teclado. Se apaga
          la opacidad y se quita el ratón por separado, y el foco lo devuelve
          entero — que es como se llega aquí tabulando desde el propio Nodo.

          `nodrag` porque ahora vive sobre el asa del arrastre: sin él, pulsarlo
          con intención de crear empezaría a mover el Nodo. */}
      <button
        type="button"
        onClick={() => fire(tree.createChild(data.nodeId))}
        // Sin red se apaga igual que el resto de lo que escribe. Sigue
        // pintándose —solo aparece al pasar por encima— porque esconderlo
        // dejaría al Nodo sin ninguna pista de que ahí había algo.
        disabled={!data.editable}
        title={data.blocked ? CONNECTION_COPY.blocked : undefined}
        aria-label={CANVAS_COPY.addChild(named)}
        className="nodrag absolute right-0 bottom-0 z-10 hidden size-6 translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-primary bg-card text-primary opacity-0 shadow-popover transition-opacity lg:pointer-events-none lg:flex lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:focus-visible:pointer-events-auto lg:focus-visible:opacity-100"
      >
        <PlusIcon width={14} height={14} />
      </button>
    </div>
  );
}
