"use client";

import { ArrowDownIcon } from "@/components/icons/arrow-down-icon";
import { ArrowUpIcon } from "@/components/icons/arrow-up-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { MoveIcon } from "@/components/icons/move-icon";
import { SiblingIcon } from "@/components/icons/sibling-icon";
import { SubnodeIcon } from "@/components/icons/subnode-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import type { IconComponent } from "@/components/icons/types";
import { useRegistro } from "@/components/registro/registro-provider";
import { REGISTRO_COPY } from "@/lib/constants";
import { countDescendants } from "@/lib/tree/model";
import type { TreeRow } from "@/lib/tree/rows";

/**
 * Todo lo que se le puede hacer al Nodo seleccionado, en una barra.
 *
 * Es LA decisión de interfaz de esta pantalla: un toque selecciona y la barra
 * hace el resto, en vez de un menú de tres puntos por fila. El motivo es el
 * pulgar — la barra vive abajo, siempre en el mismo sitio, y cada acción es un
 * toque en lugar de dos; y de paso la lista queda limpia de botones que en
 * móvil se pulsan sin querer al desplazarse.
 *
 * En escritorio la MISMA barra se vuelve una pastilla flotante centrada. Un
 * solo mecanismo en los dos formatos: mientras compartan componente, «lo que
 * se puede hacer» no puede divergir entre el teléfono y el ordenador, que es
 * justo la paridad que pide el spec.
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

export function NodeActions({
  row,
  onMove,
  onDelete,
}: {
  /** La fila seleccionada. Su sitio entre hermanos apaga «Subir» y «Bajar». */
  row: TreeRow;
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
  const registro = useRegistro();
  const id = row.node.id;
  const text = registro.textOf(row.node).trim();
  const descendants = countDescendants(registro.nodes, id);

  /** Lanza una escritura sin esperarla: el fallo ya lo enseña la cabecera. */
  const fire = (work: Promise<unknown>) => {
    void work.catch(() => {});
  };

  const actions: Action[] = [
    {
      id: "up",
      icon: ArrowUpIcon,
      label: REGISTRO_COPY.actions.up,
      run: () => fire(registro.moveTo(id, row.index - 1)),
      disabled: row.index === 0,
    },
    {
      id: "down",
      icon: ArrowDownIcon,
      label: REGISTRO_COPY.actions.down,
      run: () => fire(registro.moveTo(id, row.index + 1)),
      disabled: row.index === row.siblingCount - 1,
    },
    {
      id: "child",
      icon: SubnodeIcon,
      label: REGISTRO_COPY.actions.child,
      run: () => fire(registro.createChild(id)),
    },
    {
      id: "sibling",
      icon: SiblingIcon,
      label: REGISTRO_COPY.actions.sibling,
      run: () => fire(registro.createSibling(id)),
    },
    { id: "move", icon: MoveIcon, label: REGISTRO_COPY.actions.move, run: onMove },
    {
      id: "remove",
      icon: TrashIcon,
      label: REGISTRO_COPY.actions.remove,
      run: onDelete,
      danger: true,
    },
  ];

  const deselect = () => registro.select(null);

  return (
    // `sticky` y no `fixed`: dentro de la columna de contenido se centra sola
    // en escritorio, donde la sidebar se come 260 px por la izquierda. Un
    // `fixed` se centraría respecto a la ventana y quedaría descuadrado.
    <div className="sticky bottom-0 z-30 -mx-6 mt-2 px-6 pt-3 pb-6 lg:mx-0 lg:px-0 lg:pb-8">
      <div className="flex flex-col gap-3 rounded-t-3xl border border-border bg-card p-4 shadow-popover lg:mx-auto lg:w-fit lg:max-w-full lg:flex-row lg:flex-wrap lg:items-center lg:justify-center lg:gap-2 lg:rounded-full lg:p-2.5">
        {/* `lg:flex-none` en el nombre: en móvil ocupa la fila entera, pero en
            la pastilla de escritorio un `flex-1` le hace reclamar hueco y
            empuja el resto a una segunda línea. */}
        <div className="flex items-center gap-2.5 lg:pl-3">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold lg:max-w-44 lg:flex-none">
            {text || REGISTRO_COPY.nodePlaceholder}
          </span>
          {descendants > 0 ? (
            <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
              {REGISTRO_COPY.subnodeCount(descendants)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={deselect}
            aria-label={REGISTRO_COPY.deselect}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <CloseIcon width={15} height={15} />
          </button>
        </div>

        <span aria-hidden="true" className="hidden h-7 w-px bg-border lg:block" />

        <div className="grid grid-cols-3 gap-2 lg:flex lg:gap-1">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.run}
              disabled={action.disabled}
              className={`flex h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border transition-colors disabled:opacity-35 lg:h-10 lg:flex-row lg:gap-2 lg:rounded-full lg:px-3 ${
                action.danger ? "text-primary" : ""
              } ${action.disabled ? "" : "hover:border-primary hover:text-primary"}`}
            >
              <action.icon width={18} height={18} />
              <span className="text-[10px] tracking-[0.08em] uppercase lg:text-xs lg:tracking-normal lg:normal-case">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
