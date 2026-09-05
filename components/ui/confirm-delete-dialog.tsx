"use client";

import { useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/errors";

/**
 * «¿Seguro?», escrito una sola vez.
 *
 * Los cuatro borrados de la app —un Proyecto, una Versión, un Nodo, un
 * Análisis— pintaban esta misma anatomía en cuatro archivos, palabra por
 * palabra. No era repetición cosmética: las decisiones que hacen que borrar sea
 * SEGURO viven aquí, y repartidas en cuatro copias divergen justo en lo que
 * alguien lee antes de perder trabajo. Es el mismo argumento que hizo nacer
 * `ErrorCard`.
 *
 * Las cuatro:
 *
 * 1. La cifra grande en vez de «y todo su contenido». Enmarcada y centrada en
 *    72 px, no en línea con el texto: la NDot es de matriz de puntos y sus
 *    cifras ocupan bastante menos alto que su `font-size`, así que al lado de
 *    una frase se quedan flotando en un hueco.
 * 2. El diálogo se queda ABIERTO cuando el borrado falla, con el motivo dentro.
 *    Cerrarlo dejaría a alguien creyendo que borró algo que sigue ahí.
 * 3. El primario se apaga sin conexión, porque la red se puede caer con el
 *    diálogo ya delante. Ver `CreateProjectDialog`.
 * 4. El par de CTA en `sm:flex-row-reverse`, para que «Borrar» no caiga donde
 *    el pulgar espera «Cancelar».
 *
 * Lo que NO trae es el texto. Cada dominio tiene el suyo en `lib/constants.ts`
 * —un Nodo pierde subnodos, un Análisis pierde Tickets— y un primitivo que
 * conozca la copia de una pantalla deja de servir para la siguiente. Ver
 * `Dialog.closeLabel`.
 *
 * Tampoco trae el estado de la conexión. `blocked` llega como prop y no de
 * `useBlocked()`: era el único provider que este archivo importaba, y ninguno
 * de sus vecinos de `components/ui/` importa ninguno. Lo que se va de aquí es
 * de dónde SALE el dato; la decisión de qué hacer con él —apagar el primario—
 * se queda, que es lo que había que dejar en un solo sitio.
 */

/** El recuadro de la cifra: cuánto se lleva por delante, y qué es. */
type DeleteFigure = {
  /** La cifra grande. El cero se enseña si el dominio lo pide: ver `figure`. */
  count: number;
  /**
   * El pie de la cifra, en versalitas.
   *
   * Llega como función y no como texto ya hecho para que la concordancia no se
   * pueda desparejar de la cifra: los dominios exportan ya su `deleteFalls(n)`
   * —«subnodo cae» contra «subnodos caen»— y aquí se invoca con el MISMO
   * número que se pinta encima.
   */
  label: (count: number) => string;
  /**
   * Al lado de la cifra: qué se lleva exactamente.
   *
   * Una frase suelta la envuelve este componente, porque dos de los llamantes
   * pasan exactamente el mismo párrafo y la clase se estaba copiando otra vez
   * —que es justo lo que este archivo existe para acabar—. Quien necesite otra
   * cosa —podar un Nodo enseña la LISTA de las bajas— manda su propio nodo y se
   * encarga del `min-w-0 flex-1` que lo hace caber al lado del recuadro.
   */
  detail: React.ReactNode;
  /**
   * Poner el recuadro DEBAJO del cuerpo.
   *
   * Solo lo pide podar un Nodo, y no por gusto: allí el cuerpo dice ya lo que
   * se lleva —«su subárbol entero»— y a la derecha de la cifra va la lista de
   * las bajas, no una frase. Leer la lista antes de saber qué es la lista no se
   * entiende.
   *
   * Vive aquí dentro y no suelto arriba porque sin recuadro no significa nada,
   * y un diálogo sin cifra —borrar un Proyecto— no debería ni poder decirlo.
   */
  below?: boolean;
};

export function ConfirmDeleteDialog({
  label,
  title,
  closeLabel,
  figure,
  body,
  submitLabel,
  pendingLabel,
  cancelLabel,
  blocked,
  onConfirm,
  onClose,
}: {
  /** El marcador de sección, sobre el título. */
  label: string;
  title: string;
  closeLabel: string;
  /**
   * El recuadro de la cifra, o nada.
   *
   * Cuándo se calla lo decide cada dominio y no este componente, porque las
   * reglas son distintas de verdad: una Versión calla mientras no sabe la
   * cuenta, un Nodo sin subnodos no tiene nada que enseñar, un Análisis sin
   * Tickets sí —el cero es la noticia— y un Proyecto no da cifra ninguna
   * porque enumera sus bajas dentro del cuerpo. Una regla única cambiaría en
   * silencio lo que enseñan tres de los cuatro.
   */
  figure?: DeleteFigure;
  /** La consecuencia. Lo que no se deshace y lo que no se toca. */
  body: React.ReactNode;
  submitLabel: string;
  /** Lo que se lee mientras borra. */
  pendingLabel: string;
  cancelLabel: string;
  /** Sin red no se borra. Ver la decisión 3 de la cabecera. */
  blocked: boolean;
  /** El borrado. Que lance si falla: el motivo se pinta aquí dentro. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Pulsar «Borrar».
   *
   * El éxito cierra el diálogo; el fallo lo deja ABIERTO con el motivo dentro.
   * Ver la decisión 2 de la cabecera.
   *
   * `pending` se levanta antes de salir y solo se baja en el `catch`. La
   * asimetría es a propósito: por el camino bueno lo siguiente que pasa es
   * `onClose`, y bajarlo ahí sería escribir estado en un componente que está a
   * punto de desmontarse. Además apaga los dos botones mientras la escritura
   * está en vuelo, que es lo que impide que un segundo clic mande un segundo
   * borrado.
   *
   * Y el error se limpia al entrar, no al salir: si no, un reintento que
   * funciona dejaría en pantalla el motivo del intento anterior.
   */
  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  const box = figure ? (
    <div className="flex items-center gap-4 rounded-[18px] border border-border p-4">
      <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
        <span className="font-display text-[44px] leading-none text-primary">
          {figure.count}
        </span>
        <span className="text-center text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
          {figure.label(figure.count)}
        </span>
      </div>
      {typeof figure.detail === "string" ? (
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-pretty text-muted-foreground">
          {figure.detail}
        </p>
      ) : (
        figure.detail
      )}
    </div>
  ) : null;

  const consequence = (
    <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
      {body}
    </p>
  );

  return (
    <Dialog
      label={label}
      title={title}
      onClose={onClose}
      closeLabel={closeLabel}
    >
      {figure?.below ? consequence : box}
      {figure?.below ? box : consequence}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-[13px] leading-relaxed text-primary"
        >
          <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2.5 pt-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={pending || blocked}
          className={`${CTA_PRIMARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          <TrashIcon width={18} height={18} />
          {pending ? pendingLabel : submitLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${CTA_SECONDARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          {cancelLabel}
        </button>
      </div>
    </Dialog>
  );
}
