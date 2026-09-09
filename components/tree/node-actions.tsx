"use client";

import { useBlocked } from "@/components/connection/connection-provider";
import { ArrowDownIcon } from "@/components/icons/arrow-down-icon";
import { ArrowUpIcon } from "@/components/icons/arrow-up-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import { CircleIcon } from "@/components/icons/circle-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { MoveIcon } from "@/components/icons/move-icon";
import { SiblingIcon } from "@/components/icons/sibling-icon";
import { SubnodeIcon } from "@/components/icons/subnode-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import type { IconComponent } from "@/components/icons/types";
import { fire } from "@/components/tree/fire";
import { APP_FRAME_BLEED } from "@/components/layout/app-frame";
import { useTree } from "@/components/tree/tree-provider";
import { CONNECTION_COPY, TREE_COPY } from "@/lib/constants";
import { inheritedStrike, type TreeRow } from "@/lib/tree/rows";

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
 * La barra es SOLO iconos. El texto de apoyo bajo cada uno competía con el
 * contenido —ocho etiquetas en versalitas debajo del árbol— y se fue al nombre
 * accesible, que es donde sigue haciendo falta. Ver `BUTTON_CLASS`.
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
  // El sangrado NO se escribe aquí: lo publica el Contenedor, que es
  // quien pone el relleno que hay que cancelar. Escrito a mano valía `-mx-6
  // px-6`, calibrado contra un `px-6` que ya no está donde estaba.
  flow: `sticky bottom-0 z-30 mt-2 pt-3 pb-6 lg:pb-8 ${APP_FRAME_BLEED}`,
  floating:
    "pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 lg:p-4",
} as const;

/**
 * El botón de la barra: solo el icono. Cuadrado de 56 en el teléfono, pastilla
 * de 40 en escritorio.
 *
 * Sin etiqueta VISIBLE, pero nunca sin nombre: cada botón lleva `aria-label`, y
 * en escritorio también `title` para quien pasa el ratón. Quitar el texto sin
 * dejar nombre accesible no limpia la barra —la rompe para quien navega con
 * lector de pantalla, y una barra de ocho iconos sin nombre es ocho veces
 * «botón»—. Por eso la etiqueta no se borró: se movió de la pantalla al nombre.
 */
const BUTTON_CLASS =
  "flex h-14 items-center justify-center rounded-2xl border border-border transition-colors disabled:opacity-35 lg:h-10 lg:rounded-full lg:px-3";

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
  // Sin red se apagan las SIETE que escriben. «Quitar» no: cerrar la barra no
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
      id: "completed",
      // Enseña a DÓNDE lleva el botón, no dónde está el Nodo: el estado ya se
      // ve en la casilla de su fila y en el tachado. Un botón que dibujara el
      // estado actual se leería como «esto ya está hecho» justo cuando lo que
      // ofrece es deshacerlo.
      icon: row.node.completed ? CircleIcon : CheckIcon,
      label: row.node.completed
        ? TREE_COPY.actions.uncomplete
        : TREE_COPY.actions.complete,
      run: () => fire(tree.setCompleted(id, !row.node.completed)),
      // Bajo un padre terminado no hay nada que cambiar aquí: el Nodo ya se ve
      // tachado, y marcarlo o desmarcarlo no movería un píxel. Por la MISMA
      // función que la casilla de la fila, para que no puedan discrepar.
      disabled: inheritedStrike(row),
    },
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
        {/* Cuatro columnas: son siete acciones más «Quitar», que son dos filas
            de cuatro exactas.

            El boceto de la vista de Nodos dibuja SIETE botones, con la X
            ocupando dos celdas para que no quedara hueco. Al entrar «Terminar»
            —el Canvas no tiene casilla, así que sin esto desde ahí se vería lo
            tachado pero no se podría tachar— la cuenta sale redonda sola y ese
            `col-span-2` sobra. Anotado en el Ticket #39, que es el que cierra
            contra ese artboard, para que no se «arregle» de vuelta. */}
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
              // ruido en las seis veces de cada siete que no hace falta.
              title={blocked ? CONNECTION_COPY.blocked : action.label}
              aria-label={action.label}
              className={`${BUTTON_CLASS} ${action.danger ? "text-primary" : ""} ${
                off ? "" : "hover:border-primary hover:text-primary"
              }`}
            >
              <action.icon width={18} height={18} />
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
              las siete que sí escriben — y con la misma forma, porque desde el
              dedo es un botón más de la misma fila. */}
          <button
            type="button"
            onClick={() => tree.select(null)}
            aria-label={TREE_COPY.deselectHint}
            title={TREE_COPY.actions.deselect}
            className={`${BUTTON_CLASS} text-muted-foreground hover:border-primary hover:text-primary`}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
