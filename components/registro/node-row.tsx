"use client";

import { useEffect, useRef } from "react";

import { TREE_COPY } from "@/lib/constants";
import type { TreeRow } from "@/lib/tree/rows";

/**
 * Una fila del árbol: sus líneas de conexión a la izquierda y su texto.
 *
 * La geometría está aquí en números y no en clases de Tailwind porque depende
 * de la profundidad, que es un dato: una clase construida desde una variable
 * no llega al CSS. Es el mismo criterio que ya usa `dashboard-nav` con el
 * ancho de la sidebar.
 */

/** Lo que se mete cada nivel. Un cuadro de 22 px por antepasado. */
const INDENT = 22;

/**
 * Dónde cae el centro del punto de un Nodo, contado desde ARRIBA de la fila.
 *
 * Fijo y no «la mitad», y eso importa: el texto de un Nodo puede ser de varias
 * líneas y entonces la caja crece hacia abajo. Con un centro relativo, la
 * línea que llega del padre se iría al medio de un párrafo; con éste, siempre
 * apunta a su primera línea, que es donde empieza la idea.
 */
const ANCHOR = 29;

/** El aire entre cajas. Va DENTRO de la fila para que las líneas no se corten. */
const GUTTER = 4;

/** El radio del punto: las raíces llevan uno mayor porque no tienen codo. */
const DOT_ROOT = 4;
const DOT_CHILD = 3;

/** La caja de texto, para que la silueta de carga mida exactamente lo mismo. */
export const BOX_HEIGHT = 50;
export const ROW_HEIGHT = BOX_HEIGHT + GUTTER * 2;
export { INDENT };

/** El centro de la columna `column`, en píxeles desde el borde izquierdo. */
function railX(column: number): number {
  return column * INDENT + INDENT / 2;
}

/**
 * Las líneas y el punto de una fila.
 *
 * Todo son `<i>` posicionados: un SVG por fila costaría un nodo del DOM más y
 * un sistema de coordenadas más, y lo que hay que dibujar son rectas de un
 * píxel entre dos puntos que ya se conocen.
 */
function Guides({ row, selected }: { row: TreeRow; selected: boolean }) {
  const { depth, rails, hasChildren } = row;
  const radius = depth === 0 ? DOT_ROOT : DOT_CHILD;
  const elbow = railX(depth - 1);
  const mine = railX(depth);

  return (
    <span
      aria-hidden="true"
      className="relative shrink-0 self-stretch"
      style={{ width: (depth + 1) * INDENT }}
    >
      {/* Los raíles de los antepasados a los que aún les quedan hermanos. El
          último de la lista es la columna del codo, y ése baja hasta el final
          solo si a ESTE Nodo le sigue un hermano. */}
      {rails.map((continues, column) =>
        continues ? (
          <i
            key={column}
            className="absolute w-px bg-edge"
            style={{ left: railX(column), top: 0, bottom: 0 }}
          />
        ) : null,
      )}

      {/* El codo: baja desde arriba hasta la altura del punto y gira hacia él.
          La mitad de arriba se dibuja siempre —incluso cuando el raíl completo
          ya la tapa— porque el último hermano no tiene raíl y sí tiene codo. */}
      {depth > 0 ? (
        <>
          <i
            className="absolute w-px bg-edge"
            style={{ left: elbow, top: 0, height: ANCHOR }}
          />
          <i
            className="absolute h-px bg-edge"
            style={{ left: elbow, top: ANCHOR, width: INDENT }}
          />
        </>
      ) : null}

      {/* Del punto sale la bajada hacia sus subnodos, que enlaza con el codo
          de la fila siguiente: entre filas no hay hueco, así que la línea es
          continua sin dibujar nada en medio. */}
      {hasChildren ? (
        <i
          className="absolute w-px bg-edge"
          style={{ left: mine, top: ANCHOR, bottom: 0 }}
        />
      ) : null}

      <i
        className={`absolute rounded-full ${
          selected || depth === 0 ? "bg-primary" : "bg-edge"
        }`}
        style={{
          left: mine - radius,
          top: ANCHOR - radius,
          width: radius * 2,
          height: radius * 2,
        }}
      />
    </span>
  );
}

export function NodeRow({
  row,
  selected,
  editing,
  text,
  onSelect,
  onEdit,
  onChange,
  onStopEditing,
}: {
  row: TreeRow;
  selected: boolean;
  editing: boolean;
  /** Lo que va en el campo: el borrador si lo hay, si no lo guardado. */
  text: string;
  onSelect: () => void;
  onEdit: () => void;
  onChange: (value: string) => void;
  onStopEditing: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);

  // El campo crece con el texto en vez de desplazarse por dentro: un Nodo es
  // una idea, y una idea que no cabe en su caja se lee peor que una lista más
  // larga. `field-sizing` haría esto en CSS, pero todavía no está en todos los
  // navegadores y esto son cuatro líneas.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, BOX_HEIGHT - 20)}px`;
  }, [text, editing]);

  // Al abrir el campo, el cursor va al final y no al principio: se entra a
  // seguir escribiendo mucho más a menudo que a corregir la primera palabra.
  useEffect(() => {
    if (!editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const empty = text.trim().length === 0;
  const named = TREE_COPY.nodeLabel(text);

  const box = `flex min-w-0 flex-1 items-start rounded-2xl border transition-colors ${
    selected || editing
      ? "border-primary"
      : "border-border hover:border-primary"
  } ${selected && !editing ? "bg-accent" : "bg-card"}`;

  return (
    <li className="flex items-stretch">
      <Guides row={row} selected={selected} />
      <div className={box} style={{ margin: `${GUTTER}px 0`, minHeight: BOX_HEIGHT }}>
        {editing ? (
          <textarea
            ref={area}
            value={text}
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onStopEditing}
            // Escape cierra el campo pero NO deselecciona: lo más probable
            // después de escribir es querer moverlo o colgarle un subnodo, y
            // eso lo hace la barra, que necesita el Nodo seleccionado.
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onStopEditing();
              }
            }}
            placeholder={TREE_COPY.nodePlaceholder}
            aria-label={TREE_COPY.edit(named)}
            className="w-full resize-none overflow-hidden bg-transparent px-3.5 py-3.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            // Un toque selecciona; el segundo abre el campo. Fusionarlos
            // levantaría el teclado del teléfono encima de la barra de
            // acciones cada vez que se toca una fila para moverla.
            onClick={selected ? onEdit : onSelect}
            aria-label={
              selected ? TREE_COPY.edit(named) : TREE_COPY.select(named)
            }
            className={`w-full px-3.5 py-3.5 text-left text-sm leading-relaxed break-words whitespace-pre-wrap ${
              selected ? "text-primary" : ""
            } ${empty ? "text-muted-foreground" : ""}`}
          >
            {empty ? TREE_COPY.nodePlaceholder : text}
          </button>
        )}
      </div>
    </li>
  );
}
