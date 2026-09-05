"use client";

/**
 * Las piezas que comparten los formularios de auth.
 *
 * Vivían dentro de `login-form.tsx` hasta que el #22 estrenó una segunda
 * pantalla con contraseña. Están aquí por lo mismo que `PasswordField` se
 * extrajo en el #7: dos copias del mismo bloque se desincronizan en cuanto
 * alguien toca una, y lo que se desincroniza primero no es el aspecto sino el
 * `aria-describedby`, el borde de error y el `autoComplete` — es decir, justo lo
 * que nadie mira en una captura.
 */

import { AlertIcon } from "@/components/icons/alert-icon";
import { EyeIcon } from "@/components/icons/eye-icon";
import { OfflineIcon } from "@/components/icons/offline-icon";
import { LABEL_CLASS } from "@/components/layout/site-chrome";
import type { AuthFailure } from "@/lib/auth/messages";
import { AUTH_COPY } from "@/lib/constants";

export const FIELD_CLASS =
  "flex h-13 w-full items-center rounded-[14px] border border-border bg-card px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/16";

export const FIELD_ERROR_CLASS = FIELD_CLASS.replace(
  "border-border",
  "border-primary",
);

/** El punto rojo que hace de pulso mientras se envía. */
export function PendingDots() {
  return (
    <span aria-hidden="true" className="flex items-center gap-1">
      <span className="size-[5px] rounded-full bg-current" />
      <span className="size-[5px] rounded-full bg-current opacity-55" />
      <span className="size-[5px] rounded-full bg-current opacity-25" />
    </span>
  );
}

/**
 * El aviso de un fallo, con el icono que corresponde a su categoría.
 *
 * El icono lo decide `retryable` y no el llamante: es lo que distingue «se
 * arregla esperando» de «esto no lo arregla insistir», y esa distinción sale de
 * la taxonomía del puerto, no de la pantalla que la muestra.
 */
export function Notice({ failure }: { failure: AuthFailure }) {
  const Icon = failure.retryable ? OfflineIcon : AlertIcon;
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-[14px] border border-primary bg-primary/7 px-4 py-3.5"
    >
      <span className="shrink-0 text-primary">
        <Icon />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold">{failure.title}</span>
        <span className="text-xs leading-relaxed text-pretty text-muted-foreground">
          {failure.detail}
        </span>
      </div>
    </div>
  );
}

/** Un campo de texto con su etiqueta y su error debajo. */
export function TextField({
  id,
  label,
  type,
  autoComplete,
  inputMode,
  placeholder,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  label: string;
  type: "email" | "text";
  autoComplete: string;
  inputMode?: "email" | "text";
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-45" : ""}`}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={type === "email" ? "email" : id}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? FIELD_ERROR_CLASS : FIELD_CLASS}
      />
      {error ? (
        <span id={`${id}-error`} className="text-xs leading-relaxed text-primary">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Un campo de contraseña con su ojo, su error y su pista.
 *
 * Existe porque hay DOS siempre que se escribe una contraseña nueva —al crear
 * cuenta y al recuperarla—, y el ojo es uno solo para los dos a propósito: al
 * repetir una contraseña lo que quieres es compararlas, y eso pide verlas
 * juntas. Por eso `visible` y `onToggleVisible` los pone quien lo monta.
 */
export function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  error,
  hint,
  visible,
  onToggleVisible,
  disabled,
}: {
  id: string;
  label: string;
  autoComplete: "new-password" | "current-password";
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  visible: boolean;
  onToggleVisible: () => void;
  disabled: boolean;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-2 ${disabled ? "opacity-45" : ""}`}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={id}
          autoComplete={autoComplete}
          placeholder={AUTH_COPY.passwordPlaceholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} pr-12`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
          aria-pressed={visible}
          className="absolute right-4 flex text-muted-foreground transition-colors hover:text-primary"
        >
          <EyeIcon className="size-5" />
        </button>
      </div>
      {error ? (
        <span
          id={`${id}-error`}
          className="text-xs leading-relaxed text-primary"
        >
          {error}
        </span>
      ) : hint ? (
        <span
          id={`${id}-hint`}
          className="text-xs leading-relaxed text-pretty text-muted-foreground"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
