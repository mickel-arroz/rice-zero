"use client";

import { useEffect, useRef } from "react";

import { CloseIcon } from "@/components/icons/close-icon";
import { ICON_BUTTON_CLASS, LABEL_CLASS } from "@/components/layout/site-chrome";

/**
 * El diálogo de la app: una pantalla en el teléfono, una tarjeta centrada en
 * escritorio.
 *
 * Es el MISMO componente en los dos formatos y no dos, por lo mismo que las
 * filas de navegación del shell: mientras compartan componente, «cerrar» y
 * «cancelar» no pueden significar una cosa en un sitio y otra en el otro.
 *
 * A mano y no con `<dialog>` nativo: `showModal()` es imperativo —hay que
 * llamarlo desde un efecto cada vez que cambia el estado— y su `::backdrop` no
 * lee las variables de tema, así que el velo habría que pintarlo aparte de
 * todas formas. Lo que se pierde es el `inert` del resto de la página, y por eso
 * el tabulador se atrapa a mano aquí abajo.
 */

/**
 * Lo que puede recibir el foco con el tabulador.
 *
 * Se consulta en cada pulsación y no se guarda: dentro del diálogo hay campos
 * que se deshabilitan mientras se guarda y un menú que aparece y desaparece,
 * así que una lista calculada al abrir estaría equivocada a la primera.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function Dialog({
  label,
  title,
  onClose,
  closeLabel,
  children,
  footer,
}: {
  /** El marcador de sección, sobre el título. */
  label: string;
  title: string;
  onClose: () => void;
  /**
   * Lo que se lee en el botón de cerrar.
   *
   * Viaja como prop y no se importa de `PROJECTS_COPY`: esto es un primitivo de
   * interfaz, y un primitivo que conoce el texto de una pantalla concreta deja
   * de servir para la siguiente.
   */
  closeLabel: string;
  children: React.ReactNode;
  /** Anclado abajo: la acción principal, o el estado del Autoguardado. */
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  /**
   * Lo que pasa UNA vez, al abrir.
   *
   * Separado del listener de teclado a propósito, y no por orden: `onClose`
   * cambia de identidad cada vez que repinta el padre —tras cada autoguardado,
   * y cada minuto cuando la lista refresca la hora—, así que un efecto que
   * dependiera de él volvería a correr y haría dos estropicios. Uno: robar el
   * foco del campo que se está escribiendo. Dos: al reejecutarse, guardar como
   * «valor anterior» el `hidden` que él mismo puso, de modo que al cerrar el
   * diálogo la página se quedaba sin poder desplazarse.
   */
  useEffect(() => {
    // Sin esto, quien navega con teclado sigue en el botón que abrió el
    // diálogo, detrás del velo.
    //
    // Pero solo si NADIE de dentro se lo llevó ya. Un campo con `autoFocus`
    // toma el foco al montarse —React lo aplica en el commit, antes de que
    // corra este efecto—, y llamar a `focus()` aquí sin mirar se lo quitaba:
    // el diálogo se abría con el cursor en el panel, y quien empezaba a
    // teclear sin pinchar el campo escribía en la nada. Pasaba en los tres
    // diálogos con campo: crear Proyecto, editar Proyecto y clonar Versión.
    const el = panel.current;
    if (el && !el.contains(document.activeElement)) el.focus();

    // El fondo no debe poder desplazarse por debajo del diálogo: en el teléfono
    // el diálogo ocupa la pantalla entera y arrastrar movería la lista de
    // detrás sin que se vea.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Volver a suscribir el listener es barato; robar el foco no. Por eso este sí
  // puede depender de `onClose`.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      // El foco da la vuelta dentro del diálogo en vez de escaparse a la página
      // de detrás, que sigue ahí y sigue siendo tabulable. Sin esto, tabular
      // desde el último campo lleva a la barra del navegador y de ahí a los
      // enlaces de la sidebar, con el diálogo todavía abierto delante.
      const focusables = [
        ...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      // Hacia atrás desde el primero —o desde el propio panel, que es donde
      // aterriza el foco al abrir— se salta al último, y al revés.
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      // `z-50`: por encima del shell, que ya vive en `z-10` para tapar el fondo
      // de puntos.
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        // Solo el velo cierra, no un arrastre que empezó dentro del panel y
        // terminó fuera — eso es seleccionar texto, no cancelar.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="flex w-full flex-col gap-5 overflow-y-auto bg-card p-6 outline-none sm:max-h-full sm:w-[560px] sm:rounded-[24px] sm:border sm:border-border"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <p className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              <span className={LABEL_CLASS}>{label}</span>
            </p>
            <h2 className="text-[22px] font-bold tracking-[0.01em]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={ICON_BUTTON_CLASS}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {children}

        {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
      </div>
    </div>
  );
}
