"use client";

import { useId } from "react";

import { LABEL_CLASS } from "@/components/layout/site-chrome";

/**
 * Un campo de texto de la app: etiqueta en versalitas sobre la caja.
 *
 * Una línea o varias según `rows`, porque son el mismo campo con distinta
 * altura y separarlos en dos componentes solo garantizaría que el día que
 * cambie el radio, uno de los dos se quede atrás.
 */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows,
  autoFocus = false,
  disabled = false,
  readOnly = false,
  title,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** Ausente = una sola línea. */
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /**
   * Se lee pero no se escribe. Es lo que usa el bloqueo sin conexión.
   *
   * Aparte de `disabled` y no en vez de él: un campo deshabilitado se pinta
   * apagado y deja de poder seleccionarse, y sin red lo que hay dentro puede
   * ser lo único que quede de una idea recién tecleada. Bloquear el teclado no
   * tiene por qué impedir copiarla.
   */
  readOnly?: boolean;
  /** El motivo, al pasar por encima. Lo pone quien bloquea. */
  title?: string;
}) {
  const id = useId();

  // `maxLength` corta en el propio campo además de validarse en la capa de
  // servicios: no es una comprobación duplicada, es que quien escribe se entere
  // al llegar al tope y no al pulsar el botón.
  const shared = {
    id,
    value,
    placeholder,
    maxLength,
    disabled,
    readOnly,
    title,
    autoFocus,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    className:
      "rounded-2xl border border-border bg-card px-4.5 text-[15px] text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-45",
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      {rows ? (
        <textarea
          {...shared}
          rows={rows}
          className={`${shared.className} resize-none py-4 leading-relaxed`}
        />
      ) : (
        <input {...shared} type="text" className={`${shared.className} h-13`} />
      )}
    </div>
  );
}
