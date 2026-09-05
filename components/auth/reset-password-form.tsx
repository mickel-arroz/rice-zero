"use client";

import { useId, useState } from "react";
import Link from "next/link";

import {
  Notice,
  PasswordField,
  PendingDots,
} from "@/components/auth/fields";
import { CheckIcon } from "@/components/icons/check-icon";
import {
  CARD_CLASS,
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import {
  describeAuthFailure,
  isExpiredResetLink,
  RESET_LINK_EXPIRED,
  type AuthFailure,
} from "@/lib/auth/messages";
import {
  MIN_PASSWORD_LENGTH,
  validateCredentials,
  type FieldErrors,
} from "@/lib/auth/validate";
import { getBackend } from "@/lib/backend";
import { AUTH_COPY, RECOVER_PARAM, ROUTES } from "@/lib/constants";

/**
 * Los cuatro estados de la pantalla, como pide el ticket.
 *
 * `expired` es un estado y no un `failure` cualquiera porque cambia MÁS que el
 * texto: sin token válido no hay nada que rellenar, así que el formulario
 * desaparece entero. Pintar dos campos de contraseña que no pueden llegar a
 * ningún sitio sería peor que decirlo.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "failed"; failure: AuthFailure }
  | { kind: "expired" }
  | { kind: "done" };

/** Donde `/login` se abre ya con el formulario de pedir otro enlace. */
const RECOVER_HREF = `${ROUTES.login}?${RECOVER_PARAM}=1`;

function Header({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        <span className={LABEL_CLASS}>{label}</span>
      </p>
      <h1 className="text-4xl leading-none tracking-[0.02em] lg:text-5xl">
        {title}
      </h1>
    </div>
  );
}

/** Sin token: la única salida es pedir otro correo. */
function Expired() {
  return (
    <div className="flex flex-col gap-5">
      <Header
        label={AUTH_COPY.reset.label}
        title={AUTH_COPY.reset.expiredTitle}
      />
      <div className={`${CARD_CLASS} flex flex-col gap-4 p-5`}>
        <Notice failure={RESET_LINK_EXPIRED} />
        <Link href={RECOVER_HREF} className={CTA_PRIMARY_CLASS}>
          {AUTH_COPY.reset.expiredCta}
        </Link>
        <Link href={ROUTES.login} className={CTA_SECONDARY_CLASS}>
          {AUTH_COPY.sentCta}
        </Link>
      </div>
    </div>
  );
}

/**
 * Hecho.
 *
 * No entra sola: el puerto promete que fijar la contraseña no deja sesión
 * abierta, y aunque la dejara, `canAct` seguiría exigiendo el email confirmado.
 * Por eso el aviso de abajo no es letra pequeña — es lo que separa «ya puedes
 * entrar» de un «email o contraseña incorrectos» que además mentiría.
 */
function Done() {
  return (
    <div className="flex flex-col gap-5">
      <Header
        label={AUTH_COPY.reset.doneLabel}
        title={AUTH_COPY.reset.doneTitle}
      />
      <div className={`${CARD_CLASS} flex flex-col gap-4.5 p-5`}>
        <span className="flex size-13 items-center justify-center rounded-full border border-primary text-primary">
          <CheckIcon className="size-6" />
        </span>
        <p className="text-[15px] leading-relaxed font-bold text-pretty">
          {AUTH_COPY.reset.doneBody}
        </p>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          {AUTH_COPY.reset.doneUnverified}
        </p>
        <Link href={ROUTES.login} className={CTA_PRIMARY_CLASS}>
          {AUTH_COPY.sentCta}
        </Link>
      </div>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  // Sin token se arranca ya en `expired`: el correo redirigió con `?error=`, o
  // alguien llegó aquí a mano. Los dos casos son el mismo para quien lo lee.
  const [status, setStatus] = useState<Status>(
    token ? { kind: "idle" } : { kind: "expired" },
  );

  const busy = status.kind === "submitting";
  const failure = status.kind === "failed" ? status.failure : null;
  const empty = password === "" || confirm === "";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;

    // Ni email ni sesión: aquí quien identifica al usuario es el token, y
    // `validateCredentials` con la acción `resetPassword` sabe que este
    // formulario tiene dos campos y ninguno es un email.
    const invalid = validateCredentials({ password, confirm }, "resetPassword");
    setFields(invalid);
    if (invalid.password || invalid.confirm) {
      setStatus({ kind: "idle" });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      await getBackend().auth.resetPassword(token, password);
      setStatus({ kind: "done" });
    } catch (error) {
      // Un token agotado no se reintenta ni se corrige escribiendo otra cosa:
      // hay que pedir otro correo, así que se cambia la pantalla entera y no
      // solo el aviso.
      setStatus(
        isExpiredResetLink(error)
          ? { kind: "expired" }
          : {
              kind: "failed",
              failure: describeAuthFailure(error, "resetPassword"),
            },
      );
    }
  }

  if (status.kind === "expired") return <Expired />;
  if (status.kind === "done") return <Done />;

  const submitLabel = failure?.retryable
    ? AUTH_COPY.retry
    : AUTH_COPY.reset.submit;

  return (
    <div className="flex flex-col gap-5">
      <Header label={AUTH_COPY.reset.label} title={AUTH_COPY.reset.title} />
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {AUTH_COPY.reset.lead}
      </p>

      <div
        className={`${CARD_CLASS} relative flex flex-col gap-4 overflow-hidden p-5`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-0.5 w-[38%] bg-primary"
          />
        ) : null}

        {failure ? <Notice failure={failure} /> : null}

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <PasswordField
            id={passwordId}
            label={AUTH_COPY.reset.passwordLabel}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            error={fields.password}
            hint={AUTH_COPY.reset.hint(MIN_PASSWORD_LENGTH)}
            visible={visible}
            onToggleVisible={() => setVisible((shown) => !shown)}
            disabled={busy}
          />

          {/* El ojo es uno solo para los dos campos, igual que al crear cuenta:
              al repetir una contraseña lo que quieres es compararlas. */}
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

          <button
            type="submit"
            aria-busy={busy}
            aria-disabled={empty || busy}
            className={`${CTA_PRIMARY_CLASS} ${empty && !busy ? "opacity-45" : ""}`}
          >
            {busy ? (
              <>
                <PendingDots />
                {AUTH_COPY.reset.pending}
              </>
            ) : (
              submitLabel
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
