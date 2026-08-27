"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { GoogleIcon } from "@/components/icons/google-icon";
import { MailIcon } from "@/components/icons/mail-icon";
import { OfflineIcon } from "@/components/icons/offline-icon";
import { AlertIcon } from "@/components/icons/alert-icon";
import { EyeIcon } from "@/components/icons/eye-icon";
import {
  CARD_CLASS,
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
  LINK_CLASS,
} from "@/components/layout/site-chrome";
import {
  describeAuthFailure,
  type AuthAction,
  type AuthFailure,
} from "@/lib/auth/messages";
import {
  MIN_PASSWORD_LENGTH,
  validateCredentials,
  type FieldErrors,
} from "@/lib/auth/validate";
import { getBackend } from "@/lib/backend";
import { AUTH_COPY, ROUTES } from "@/lib/constants";

/**
 * Los cuatro estados que el #7 pide explícitos, más el modo.
 *
 * Es una unión y no un puñado de booleanos para que no exista «cargando y con
 * error a la vez»: el formulario solo puede estar en uno.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting"; via: "email" | "google" }
  | { kind: "failed"; failure: AuthFailure }
  /** Cuenta creada y pendiente de confirmar: el email es lo que se muestra. */
  | { kind: "sent"; email: string };

const FIELD_CLASS =
  "flex h-13 w-full items-center rounded-[14px] border border-border bg-card px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/16";

const FIELD_ERROR_CLASS = FIELD_CLASS.replace(
  "border-border",
  "border-primary",
);

const TAB_CLASS =
  "flex h-9 flex-1 items-center justify-center rounded-full text-xs uppercase tracking-[0.08em] transition-colors";

const TAB_ON_CLASS = `${TAB_CLASS} bg-accent font-bold text-accent-foreground`;

const TAB_OFF_CLASS = `${TAB_CLASS} text-muted-foreground hover:text-foreground`;

/** El punto rojo que hace de pulso mientras se envía. */
function PendingDots() {
  return (
    <span aria-hidden="true" className="flex items-center gap-1">
      <span className="size-[5px] rounded-full bg-current" />
      <span className="size-[5px] rounded-full bg-current opacity-55" />
      <span className="size-[5px] rounded-full bg-current opacity-25" />
    </span>
  );
}

function Notice({ failure }: { failure: AuthFailure }) {
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

/**
 * La pantalla de «revisa tu correo».
 *
 * No ofrece «reenviar»: el puerto no tiene esa operación, y llamar otra vez a
 * `signUpWithEmail` devolvería `ConflictError`. Lo que sí reenvía el correo es
 * intentar entrar sin confirmar, así que el único botón lleva ahí.
 */
function ConfirmEmail({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className={LABEL_CLASS}>{AUTH_COPY.sentLabel}</span>
        </p>
        <h1 className="text-4xl leading-none tracking-[0.02em]">
          {AUTH_COPY.sentTitle}
        </h1>
      </div>

      <div className={`${CARD_CLASS} flex flex-col gap-4.5 p-5`}>
        <span className="flex size-13 items-center justify-center rounded-full border border-primary text-primary">
          <MailIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>{AUTH_COPY.sentToLabel}</span>
          <span className="text-[15px] font-bold break-all">{email}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
          {AUTH_COPY.sentBody}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {AUTH_COPY.sentSpam}
        </p>
        <button type="button" onClick={onBack} className={CTA_SECONDARY_CLASS}>
          {AUTH_COPY.sentCta}
        </button>
      </div>
    </div>
  );
}

/**
 * Un campo de contraseña con su ojo, su error y su pista.
 *
 * Existe porque al crear cuenta hay DOS, y dos copias del mismo bloque de 40
 * líneas se desincronizan en cuanto alguien toca una: el `aria-describedby`, el
 * borde rojo o el `autoComplete` acabarían distintos.
 */
function PasswordField({
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

export function LoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const [action, setAction] = useState<AuthAction>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const busy = status.kind === "submitting" || pending;
  const failure = status.kind === "failed" ? status.failure : null;
  /** Empty: sin nada escrito el CTA se ve inerte, pero no se deshabilita. */
  const empty =
    email.trim() === "" ||
    password === "" ||
    (action === "signUp" && confirm === "");

  function switchTo(next: AuthAction) {
    setAction(next);
    setConfirm("");
    setFields({});
    setStatus({ kind: "idle" });
  }

  /** Tras entrar, el destino lo decidió el servidor y ya viene comprobado. */
  function goToDestination() {
    // `refresh` antes de navegar, igual que al salir: la ruta protegida se
    // renderiza en servidor con la sesión de la petición, y sin esto el Router
    // Cache podría servir la versión que se prerenderizó SIN sesión.
    router.refresh();
    // `replace` y no `push`: el login no debe quedar en el historial detrás de
    // la ruta protegida, o el botón de atrás devuelve a un formulario ya usado.
    router.replace(destination);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    // `confirm` solo viaja al crear cuenta; el puerto nunca lo ve, se queda en
    // la validación local.
    const credentials = {
      email: email.trim(),
      password,
      ...(action === "signUp" ? { confirm } : {}),
    };
    const invalid = validateCredentials(credentials, action);
    setFields(invalid);
    if (invalid.email || invalid.password || invalid.confirm) {
      setStatus({ kind: "idle" });
      return;
    }

    setStatus({ kind: "submitting", via: "email" });
    try {
      const auth = getBackend().auth;
      const forPort = {
        email: credentials.email,
        password: credentials.password,
      };
      if (action === "signUp") {
        const { needsEmailVerification } = await auth.signUpWithEmail(forPort);
        // Si el proveedor NO exige confirmación, la cuenta ya está dentro y
        // mandarla a «revisa tu correo» sería mentir.
        if (needsEmailVerification) {
          setStatus({ kind: "sent", email: credentials.email });
          return;
        }
      } else {
        await auth.signInWithEmail(forPort);
      }
      // El estado se queda en `submitting` a propósito: la navegación ya está en
      // marcha y volver a `idle` haría que el botón dejara de decir «Entrando»
      // con los campos todavía apagados. El componente se desmonta al llegar.
      startTransition(goToDestination);
    } catch (error) {
      setStatus({
        kind: "failed",
        failure: describeAuthFailure(error, action),
      });
    }
  }

  async function withGoogle() {
    if (busy) return;
    setStatus({ kind: "submitting", via: "google" });
    try {
      // Absoluta: el proveedor redirige desde su propio dominio, así que una
      // ruta relativa no le sirve de vuelta.
      const back = new URL(destination, window.location.origin).toString();
      await getBackend().auth.signInWithGoogle(back);
      // No se restaura el estado: si la llamada no lanzó, el navegador ya está
      // saliendo hacia Google y el formulario debe seguir bloqueado.
    } catch (error) {
      setStatus({
        kind: "failed",
        failure: describeAuthFailure(error, action),
      });
    }
  }

  if (status.kind === "sent") {
    return (
      <ConfirmEmail email={status.email} onBack={() => switchTo("signIn")} />
    );
  }

  const copy = AUTH_COPY[action];
  const submitLabel = failure?.retryable ? AUTH_COPY.retry : copy.submit;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className={LABEL_CLASS}>{AUTH_COPY.label}</span>
        </p>
        <h1 className="text-4xl leading-none tracking-[0.02em] lg:text-[56px]">
          {copy.title}
        </h1>
        {action === "signIn" ? (
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {AUTH_COPY.lead}
          </p>
        ) : null}
      </div>

      <div
        className={`${CARD_CLASS} relative flex flex-col gap-4 overflow-hidden p-5`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 w-[38%] bg-primary"
          />
        ) : null}

        <div
          role="tablist"
          aria-label={AUTH_COPY.label}
          className="flex gap-1 rounded-full border border-border p-1"
        >
          {(["signIn", "signUp"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={action === tab}
              onClick={() => switchTo(tab)}
              className={action === tab ? TAB_ON_CLASS : TAB_OFF_CLASS}
            >
              {AUTH_COPY[tab].tab}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={withGoogle}
          disabled={busy}
          className={`${CTA_SECONDARY_CLASS} ${busy ? "opacity-45" : ""}`}
        >
          <GoogleIcon />
          {AUTH_COPY.google}
        </button>

        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span className={LABEL_CLASS}>{copy.divider}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>

        {failure ? <Notice failure={failure} /> : null}

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className={`flex flex-col gap-2 ${busy ? "opacity-45" : ""}`}>
            <label htmlFor={emailId} className={LABEL_CLASS}>
              {AUTH_COPY.emailLabel}
            </label>
            <input
              id={emailId}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder={AUTH_COPY.emailPlaceholder}
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fields.email ? true : undefined}
              aria-describedby={fields.email ? `${emailId}-error` : undefined}
              className={fields.email ? FIELD_ERROR_CLASS : FIELD_CLASS}
            />
            {fields.email ? (
              <span
                id={`${emailId}-error`}
                className="text-xs leading-relaxed text-primary"
              >
                {fields.email}
              </span>
            ) : null}
          </div>

          <PasswordField
            id={passwordId}
            label={copy.passwordLabel}
            autoComplete={
              action === "signUp" ? "new-password" : "current-password"
            }
            value={password}
            onChange={setPassword}
            error={fields.password}
            hint={
              action === "signUp"
                ? AUTH_COPY.passwordHint(MIN_PASSWORD_LENGTH)
                : undefined
            }
            visible={visible}
            onToggleVisible={() => setVisible((shown) => !shown)}
            disabled={busy}
          />

          {/* El ojo es uno solo para los dos campos a propósito: al repetir una
              contraseña lo que quieres es compararlas, y eso pide verlas juntas. */}
          {action === "signUp" ? (
            <PasswordField
              id={confirmId}
              label={AUTH_COPY.confirmLabel}
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              error={fields.confirm}
              visible={visible}
              onToggleVisible={() => setVisible((shown) => !shown)}
              disabled={busy}
            />
          ) : null}

          <button
            type="submit"
            aria-busy={busy}
            aria-disabled={empty || busy}
            className={`${CTA_PRIMARY_CLASS} ${empty && !busy ? "opacity-45" : ""}`}
          >
            {busy && status.kind === "submitting" && status.via === "email" ? (
              <>
                <PendingDots />
                {copy.pending}
              </>
            ) : (
              submitLabel
            )}
          </button>
        </form>
      </div>

      <Link
        href={ROUTES.about}
        className={`self-start text-[13px] ${LINK_CLASS}`}
      >
        {AUTH_COPY.aboutLink}
      </Link>
    </div>
  );
}
