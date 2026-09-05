"use client";

import { useBlocked } from "@/components/connection/connection-provider";
import { ArrowDownIcon } from "@/components/icons/arrow-down-icon";
import { ArrowUpIcon } from "@/components/icons/arrow-up-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { MoveIcon } from "@/components/icons/move-icon";
import { SiblingIcon } from "@/components/icons/sibling-icon";
import { SubnodeIcon } from "@/components/icons/subnode-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import type { IconComponent } from "@/components/icons/types";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { CONNECTION_COPY, TREE_COPY } from "@/lib/constants";
import type { TreeRow } from "@/lib/tree/rows";

/**
 * Todo lo que se le puede hacer al Nodo seleccionado, en una barra.
 *
 * Es LA decisión de interfaz del árbol: un toque selecciona y la barra hace el
 * resto, en vez de un menú de tres puntos por Nodo. El motivo es el pulgar —
 * la barra vive abajo, siempre en el mismo sitio, y cada acción es un toque en
 * lugar de dos; y de paso la lista queda limpia de botones que en móvil se
 * pulsan sin querer al desplazarse.
 *
 * Vive en `components/tree` y no dentro de una vista porque la comparten la
 * Vista Registro y la Vista Canvas. Es la misma decisión que ya se tomó con
 * `NavRow`: mientras compartan componente, «lo que se le puede hacer a un
 * Nodo» no puede significar una cosa en una vista y otra en la otra. El día
 * que se dupliquen, sí.
 *
 * En escritorio la MISMA barra se vuelve una pastilla flotante centrada. Un
 * solo mecanismo en los dos formatos y en las dos vistas.
 *
 * Lo que la barra NO hace es decir sobre qué Nodo actúa. Enseñaba su texto y
 * cuántos subnodos caían con él, y se quitó a propósito: en el Canvas el Nodo
 * seleccionado ya se ve —lo marca su propio borde—, así que repetir su texto
 * aquí era decir dos veces lo mismo y comerse el ancho de la pastilla. Quien
 * necesita nombrar al Nodo es la CONFIRMACIÓN de borrado, y ahí sigue.
 */

type Action = {
  id: string;
  icon: IconComponent;
  label: string;
  run: () => void;
  /** Apagada, con el motivo implícito: no hay a dónde subir, no hay qué bajar. */
  disabled?: boolean;
  danger?: boolean;
};

/**
 * Dónde se pone la barra.
 *
 * `flow` es la de la Vista Registro: va detrás de la lista, pegada abajo, y le
 * quita a la lista el alto que ocupa. Ahí es lo correcto — la lista se
 * desplaza y su final tiene que quedar alcanzable por encima de la barra.
 *
 * `floating` es la del Canvas: FLOTA sobre el lienzo sin ocupar sitio. Un
 * lienzo que encoge al seleccionar un Nodo movería el árbol entero bajo el
 * dedo justo al tocarlo, que es lo contrario de lo que se espera al señalar
 * algo. El envoltorio deja pasar el ratón (`pointer-events-none`) para no
 * robarle al lienzo la franja de abajo; solo la pastilla lo recoge.
 */
const WRAPPER_CLASS = {
  flow: "sticky bottom-0 z-30 -mx-6 mt-2 px-6 pt-3 pb-6 lg:mx-0 lg:px-0 lg:pb-8",
  floating:
    "pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 lg:p-4",
} as const;

/** El botón de la barra: cuadrado con etiqueta debajo, pastilla en escritorio. */
const BUTTON_CLASS =
  "flex h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border transition-colors disabled:opacity-35 lg:h-10 lg:flex-row lg:gap-2 lg:rounded-full lg:px-3";

const BUTTON_LABEL_CLASS =
  "text-[10px] tracking-[0.08em] uppercase lg:text-xs lg:tracking-normal lg:normal-case";

export function NodeActions({
  row,
  onMove,
  onDelete,
  floating = false,
  className = "",
}: {
  /** El Nodo seleccionado. Su sitio entre hermanos apaga «Subir» y «Bajar». */
  row: TreeRow;
  /** Flotar sobre el lienzo en vez de ir detrás de la lista. Ver `WRAPPER_CLASS`. */
  floating?: boolean;
  /**
   * Se pega al contenedor de la barra, no a un envoltorio.
   *
   * Existe por un solo llamante —el Canvas la esconde por debajo de `lg`, que
   * es donde el lienzo es solo consulta— y llega hasta aquí en vez de meterla
   * en un `<div>` por fuera porque el contenedor está posicionado: envolverlo
   * le cambiaría el bloque contenedor y la barra dejaría de pegarse abajo.
   */
  className?: string;
  /**
   * Las dos acciones que NO escriben: abren un diálogo.
   *
   * Llegan como props mientras las demás salen del provider, y la asimetría es
   * la que hay: quién está abierto delante es estado de la pantalla, no del
   * árbol. Lo que se escribe se pide donde vive; lo que se enseña, a quien lo
   * enseña.
   */
  onMove: () => void;
  onDelete: () => void;
}) {
  // El resto se pide directo al provider, igual que hacen los dos diálogos. Con
  // siete callbacks de props, la pantalla tenía que reenviar una por una unas
  // operaciones que no son suyas.
  const tree = useTree();
  // Sin red se apagan las SEIS que escriben. «Quitar» no: cerrar la barra no
  // toca el árbol, y dejar a la persona con una barra que no se puede quitar
  // encima de la pantalla sería castigarla por quedarse sin conexión.
  const blocked = useBlocked();
  const id = row.node.id;

  const actions: Action[] = [
    {
      id: "up",
      icon: ArrowUpIcon,
      label: TREE_COPY.actions.up,
      run: () => fire(tree.moveTo(id, row.index - 1)),
      disabled: row.index === 0,
    },
    {
      id: "down",
      icon: ArrowDownIcon,
      label: TREE_COPY.actions.down,
      run: () => fire(tree.moveTo(id, row.index + 1)),
      disabled: row.index === row.siblingCount - 1,
    },
    {
      id: "child",
      icon: SubnodeIcon,
      label: TREE_COPY.actions.child,
      run: () => fire(tree.createChild(id)),
    },
    {
      id: "sibling",
      icon: SiblingIcon,
      label: TREE_COPY.actions.sibling,
      run: () => fire(tree.createSibling(id)),
    },
    { id: "move", icon: MoveIcon, label: TREE_COPY.actions.move, run: onMove },
    {
      id: "remove",
      icon: TrashIcon,
      label: TREE_COPY.actions.remove,
      run: onDelete,
      danger: true,
    },
  ];

  return (
    // Nunca `fixed`: dentro de la columna de contenido la pastilla se centra
    // sola en escritorio, donde la sidebar se come 260 px por la izquierda. Un
    // `fixed` se centraría respecto a la ventana y quedaría descuadrado.
    <div className={`${WRAPPER_CLASS[floating ? "floating" : "flow"]} ${className}`}>
      <div
        className={`pointer-events-auto border border-border bg-card p-4 shadow-popover lg:mx-auto lg:w-fit lg:max-w-full lg:rounded-full lg:p-2.5 ${
          floating ? "rounded-3xl" : "rounded-t-3xl"
        }`}
      >
        {/* Cuatro columnas y no tres: son seis acciones más «Quitar», y con
            `col-span-2` en la última la rejilla queda exacta en dos filas de
            cuatro en vez de dejar un hueco a la derecha. */}
        <div className="grid grid-cols-4 gap-2 lg:flex lg:items-center lg:gap-1">
          {actions.map((action) => {
            const off = blocked || action.disabled;
            return (
            <button
              key={action.id}
              type="button"
              onClick={action.run}
              disabled={off}
              // Solo cuando el motivo es la red. «No hay a dónde subir» ya se
              // entiende del sitio del Nodo, y repetirlo en un `title` sería
              // ruido en las cinco veces de cada seis que no hace falta.
              title={blocked ? CONNECTION_COPY.blocked : undefined}
              className={`${BUTTON_CLASS} ${action.danger ? "text-primary" : ""} ${
                off ? "" : "hover:border-primary hover:text-primary"
              }`}
            >
              <action.icon width={18} height={18} />
              <span className={BUTTON_LABEL_CLASS}>{action.label}</span>
            </button>
            );
          })}

          {/* Solo en escritorio: en la pastilla separa las acciones del cierre.
              En móvil la rejilla ya los separa por filas y una raya suelta
              robaría una celda. */}
          <span
            aria-hidden="true"
            className="hidden lg:mx-1 lg:block lg:h-7 lg:w-px lg:self-center lg:bg-border"
          />

          {/* «Quitar» cierra la barra sin tocar el árbol, así que va aparte de
              las seis que sí escriben — y con la misma forma, porque desde el
              dedo es un botón más de la misma fila. */}
          <button
            type="button"
            onClick={() => tree.select(null)}
            aria-label={TREE_COPY.deselectHint}
            className={`${BUTTON_CLASS} col-span-2 text-muted-foreground hover:border-primary hover:text-primary lg:col-span-1`}
          >
            <CloseIcon width={18} height={18} />
            <span className={BUTTON_LABEL_CLASS}>{TREE_COPY.actions.deselect}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
