"use client";

import { useEffect, useRef } from "react";

import { CheckIcon } from "@/components/icons/check-icon";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import { STRUCK_CLASS } from "@/components/layout/site-chrome";
import { CONNECTION_COPY, TREE_COPY } from "@/lib/constants";
import { useTreeKeys } from "@/components/tree/use-tree-keys";
import { inheritedStrike, type TreeRow } from "@/lib/tree/rows";

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

/**
 * La casilla de completado: 18 px, y 2 más de caída que el texto.
 *
 * Los 2 px no son un ajuste fino cualquiera: alinean la casilla con la ALTURA
 * DE MAYÚSCULA de la primera línea y no con el borde de su caja de línea. Sin
 * ellos la casilla se lee alta, porque `leading-relaxed` deja aire por encima
 * del texto que la casilla no tiene.
 */
const CHECKBOX = 18;
const CHECKBOX_DROP = 2;

/** El relleno de la caja de texto. Lo comparten el campo, el botón y la casilla. */
const BOX_PADDING = 14;

/**
 * Lo mínimo que puede medir la caja de texto, en píxeles.
 *
 * La caja es lo único de la fila que encoge —las guías de la izquierda miden
 * `INDENT` por nivel y no ceden—, así que sin un suelo una rama profunda la
 * dejaba en una tira de dos caracteres por línea. Con éste, la fila deja de
 * caber y la LISTA se desplaza (ver `registro-view.tsx`); el ancho de una idea
 * ya no depende de a qué hondura se escribió.
 *
 * 240 es lo que ocupa la caja de un Nodo raíz en el teléfono más estrecho que
 * la app soporta: por debajo de eso el texto ya se leía mal, así que es el
 * ancho por el que el Registro ya había pasado la prueba.
 */
const MIN_BOX = 240;



/** El radio del punto: las raíces llevan uno mayor porque no tienen codo. */
const DOT_ROOT = 4;
const DOT_CHILD = 3;

/**
 * El botón de plegar: 18 px, centrado en el MISMO punto que el punto.
 *
 * Reutiliza el centro del punto —`railX(depth)` y `ANCHOR`— y no se pone al
 * lado, y eso es lo que hace que las líneas del árbol no se muevan cuando
 * aparece: el codo llega a la misma coordenada, la bajada sale de la misma
 * coordenada, y lo único que cambia es qué se dibuja ahí. Un botón que ocupara
 * su propio hueco desplazaría media columna cada vez que una rama gana o pierde
 * su primer hijo.
 *
 * Que sea más ancho que el carril (18 contra 22 de `INDENT`) tampoco molesta:
 * está posicionado en absoluto, así que no empuja a nada.
 */
const TOGGLE = 18;

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
function Guides({
  row,
  selected,
  collapsed,
  onToggleCollapsed,
}: {
  row: TreeRow;
  selected: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const { depth, rails, hasChildren } = row;
  const radius = depth === 0 ? DOT_ROOT : DOT_CHILD;
  const elbow = railX(depth - 1);
  const mine = railX(depth);
  const named = TREE_COPY.nodeLabel(row.node.content);

  return (
    // Sin `aria-hidden` cuando hay algo que pulsar: el botón de plegar vive
    // dentro de esta columna, y escondérsela entera a un lector de pantalla lo
    // escondería a él también. Las líneas siguen siendo decorativas y cada una
    // lo dice por su cuenta.
    <span
      aria-hidden={hasChildren ? undefined : "true"}
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
          continua sin dibujar nada en medio.

          Plegado no la dibuja: debajo ya no hay nada a lo que bajar, y una
          línea que sale hacia el vacío es exactamente la señal contraria a la
          que este botón acaba de dar. */}
      {hasChildren && !collapsed ? (
        <i
          aria-hidden="true"
          className="absolute w-px bg-edge"
          style={{ left: mine, top: ANCHOR, bottom: 0 }}
        />
      ) : null}

      {/* El punto pasa a botón de plegar en cuanto hay algo que plegar, y en su
          MISMO centro: ver `TOGGLE`. Sin hijos se queda como estaba, porque no
          hay nada que ofrecer. */}
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? TREE_COPY.expand(named) : TREE_COPY.collapse(named)
          }
          className={`absolute flex items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-primary hover:text-primary ${
            selected || depth === 0 ? "text-primary" : "text-muted-foreground"
          }`}
          style={{
            left: mine - TOGGLE / 2,
            top: ANCHOR - TOGGLE / 2,
            width: TOGGLE,
            height: TOGGLE,
          }}
        >
          {collapsed ? (
            <ChevronRightIcon width={12} height={12} />
          ) : (
            <ChevronDownIcon width={12} height={12} />
          )}
        </button>
      ) : (
        <i
          aria-hidden="true"
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
      )}
    </span>
  );
}

/**
 * La casilla de un Nodo.
 *
 * Se pinta SIEMPRE, también en los pendientes: es lo que hace que completar
 * sea un gesto de un toque y no algo escondido en la barra de acciones. Ver el
 * boceto de la vista de Nodos.
 *
 * Marcada por herencia se apaga en vez de esconderse. Un Nodo bajo un padre
 * terminado se ve tachado aunque él siga guardado como pendiente, así que una
 * casilla pulsable ahí prometería un cambio que no se vería en ningún sitio.
 */
function Checkbox({
  row,
  blocked,
  onToggle,
}: {
  row: TreeRow;
  blocked: boolean;
  onToggle: () => void;
}) {
  const { completed } = row.node;
  const inherited = inheritedStrike(row);
  const named = TREE_COPY.nodeLabel(row.node.content);

  return (
    <button
      type="button"
      role="checkbox"
      // `aria-checked` sale de lo PINTADO y la etiqueta de lo GUARDADO, y esa
      // asimetría es la correcta. Marcada dice cómo se ve, que es lo que hay
      // que anunciar; la etiqueta dice qué haría el botón, y un hijo bajo un
      // padre terminado sigue guardado como pendiente — anunciarle «devolver a
      // pendiente» sería justo lo contrario de lo que ocurriría. Cuando ni
      // siquiera va a ocurrir nada, la etiqueta deja de prometer una acción y
      // cuenta el motivo.
      aria-checked={row.struck}
      aria-label={
        inherited
          ? `${named} — ${TREE_COPY.completedByParent}`
          : completed
            ? TREE_COPY.uncomplete(named)
            : TREE_COPY.complete(named)
      }
      disabled={inherited || blocked}
      title={
        inherited
          ? TREE_COPY.completedByParent
          : blocked
            ? CONNECTION_COPY.blocked
            : undefined
      }
      onClick={onToggle}
      className={`flex shrink-0 items-center justify-center rounded-md border transition-colors ${
        row.struck
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-primary"
      }`}
      style={{
        width: CHECKBOX,
        height: CHECKBOX,
        marginTop: BOX_PADDING + CHECKBOX_DROP,
        marginLeft: BOX_PADDING,
      }}
    >
      {row.struck ? <CheckIcon width={12} height={12} /> : null}
    </button>
  );
}

export function NodeRow({
  row,
  selected,
  editing,
  text,
  blocked,
  onSelect,
  onEdit,
  onChange,
  onStopEditing,
  onToggleCompleted,
  collapsed,
  onToggleCollapsed,
}: {
  row: TreeRow;
  selected: boolean;
  editing: boolean;
  /** Su subárbol está doblado. Solo puede estarlo si tiene hijos. */
  collapsed: boolean;
  /** Lo que va en el campo: el borrador si lo hay, si no lo guardado. */
  text: string;
  /**
   * Sin conexión: el texto se lee pero no se toca.
   *
   * Llega como prop y no de `useBlocked()` aquí dentro porque esta fila ya
   * recibe TODO lo demás de quien la pinta —lo seleccionado, lo que se está
   * editando, el texto— y sacar un solo dato de un contexto propio la
   * convertiría en el único componente del Registro que sabe cosas por su
   * cuenta. La vista es quien decide; la fila pinta.
   */
  blocked: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onChange: (value: string) => void;
  onStopEditing: () => void;
  onToggleCompleted: () => void;
  onToggleCollapsed: () => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const onKeyDown = useTreeKeys(row.node.id);

  /**
   * El foco del navegador sigue a la selección.
   *
   * Sin esto, mover el foco con el teclado movía la pastilla del seleccionado
   * pero dejaba las teclas llegando a la fila de la que se salió, así que la
   * segunda pulsación no avanzaba.
   *
   * `selected && !editing` es lo que impide que pise nada: mientras se escribe
   * manda el campo, y al crear un Nodo el `run` lo deja en edición — este
   * efecto no se lo quita.
   */
  useEffect(() => {
    if (!selected || editing) return;
    const el = button.current;
    if (el && el !== document.activeElement) el.focus();
  }, [selected, editing]);

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
    // `w-fit min-w-full`: la fila mide lo que mide su contenido, y al menos el
    // ancho de la lista. Sin `w-fit` una fila más ancha que la pantalla
    // desbordaría DENTRO de su `<li>` en vez de estirarlo, y la lista no
    // tendría nada que desplazar.
    <li className="flex w-fit min-w-full items-stretch">
      <Guides
        row={row}
        selected={selected}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
      <div
        className={box}
        style={{
          margin: `${GUTTER}px 0`,
          minHeight: BOX_HEIGHT,
          minWidth: MIN_BOX,
        }}
      >
        <Checkbox row={row} blocked={blocked} onToggle={onToggleCompleted} />
        {editing ? (
          <textarea
            ref={area}
            value={text}
            rows={1}
            // `readOnly` y no `disabled`: un campo deshabilitado se pinta gris
            // y deja de poder seleccionarse con el dedo, y lo que se está
            // bloqueando es ESCRIBIR, no leer. Lo que hay dentro es la idea que
            // la persona acaba de teclear, y sin red es justo cuando más
            // quiere poder mirarla y copiarla.
            readOnly={blocked}
            title={blocked ? CONNECTION_COPY.blocked : undefined}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onStopEditing}
            // Escape cierra el campo pero NO deselecciona: lo más probable
            // después de escribir es querer moverlo o colgarle un subnodo, y
            // eso lo hace la barra, que necesita el Nodo seleccionado.
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onStopEditing();
                return;
              }
              // El resto se lo ofrece al mapa, que con el campo abierto solo se
              // queda los dos atajos de crear y deja pasar todo lo demás.
              onKeyDown(event);
            }}
            placeholder={TREE_COPY.nodePlaceholder}
            aria-label={TREE_COPY.edit(named)}
            className="w-full resize-none overflow-hidden bg-transparent py-3.5 pr-3.5 pl-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            // Un toque selecciona; el segundo abre el campo. Fusionarlos
            // levantaría el teclado del teléfono encima de la barra de
            // acciones cada vez que se toca una fila para moverla.
            //
            // Sin red el segundo toque no abre nada: levantar el teclado sobre
            // un campo que no acepta teclas es prometer una edición que no va
            // a poder ocurrir. Seleccionar SÍ se puede, porque de eso vive el
            // borrado y el movimiento que se harán al volver la conexión.
            onClick={selected && !blocked ? onEdit : onSelect}
            // El mapa de teclado del árbol. Va en el botón de la fila y no en
            // un oyente global porque «el Nodo enfocado» es literalmente el que
            // tiene el foco del navegador: así teclear escribe donde se está
            // mirando, y ninguna tecla se dispara desde el campo de un diálogo
            // ni desde el título de la Versión.
            onKeyDown={onKeyDown}
            ref={button}
            aria-label={
              selected && !blocked
                ? TREE_COPY.edit(named)
                : TREE_COPY.select(named)
            }
            className={`w-full py-3.5 pr-3.5 pl-2.5 text-left text-sm leading-relaxed break-words whitespace-pre-wrap ${
              row.struck ? STRUCK_CLASS : selected ? "text-primary" : ""
            } ${empty && !row.struck ? "text-muted-foreground" : ""}`}
          >
            {empty ? TREE_COPY.nodePlaceholder : text}
          </button>
        )}
      </div>
    </li>
  );
}
