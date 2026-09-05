"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  Notice,
  PasswordField,
  PendingDots,
  TextField,
} from "@/components/auth/fields";
import { GoogleIcon } from "@/components/icons/google-icon";
import { MailIcon } from "@/components/icons/mail-icon";
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
  type AuthTab,
} from "@/lib/auth/messages";
import {
  MIN_PASSWORD_LENGTH,
  validateCredentials,
  type Credentials,
  type FieldErrors,
} from "@/lib/auth/validate";
import { getBackend } from "@/lib/backend";
import { AUTH_COPY, ROUTES } from "@/lib/constants";

/**
 * Las dos pestañas, más el modo que no lo es.
 *
 * `recover` NO es una tercera pestaña: reemplaza el contenido del card entero
 * —sin pestañas, sin Google, sin separador—, igual que hace «Revisa tu correo»
 * tras crear cuenta. Ponerlo en la misma unión es lo que impide que exista
 * «recuperando Y en la pestaña de crear cuenta».
 */
type Mode = AuthTab | "recover";

/**
 * Los cuatro estados que el #7 pide explícitos, más el del #22.
 *
 * Es una unión y no un puñado de booleanos para que no exista «cargando y con
 * error a la vez»: el formulario solo puede estar en uno.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting"; via: "email" | "google" }
  | { kind: "failed"; failure: AuthFailure }
  /** Cuenta creada y pendiente de confirmar: el email es lo que se muestra. */
  | { kind: "sent"; email: string }
  /** Enlace de recuperación pedido. Dice lo mismo exista o no la cuenta. */
  | { kind: "resetSent"; email: string };

const TAB_CLASS =
  "flex h-9 flex-1 items-center justify-center rounded-full text-xs uppercase tracking-[0.08em] transition-colors";

const TAB_ON_CLASS = `${TAB_CLASS} bg-accent font-bold text-accent-foreground`;

const TAB_OFF_CLASS = `${TAB_CLASS} text-muted-foreground hover:text-foreground`;

/**
 * La pantalla de «te hemos mandado un correo», con su sobre y su destinatario.
 *
 * La comparten los dos correos que esta pantalla puede provocar —el de
 * confirmar la cuenta y el de recuperar la contraseña— porque son la misma
 * forma: un sobre, a quién fue, qué hacer y qué pasa si no llega.
 *
 * Lo que cambia viaja en UN prop y no en cuatro sueltos: los cuatro textos
 * salen siempre del mismo bloque de `AUTH_COPY`, así que desmontarlos en el
 * call site para volver a montarlos aquí solo abría el hueco de cruzar el
 * cuerpo de un correo con el título del otro.
 */
function MailSent({
  copy,
  email,
  onBack,
}: {
  copy: (typeof AUTH_COPY.mailSent)[keyof typeof AUTH_COPY.mailSent];
  email: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className={LABEL_CLASS}>{copy.label}</span>
        </p>
        <h1 className="text-4xl leading-none tracking-[0.02em]">{copy.title}</h1>
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
          {copy.body}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {copy.spam}
        </p>
        <button type="button" onClick={onBack} className={CTA_SECONDARY_CLASS}>
          {AUTH_COPY.sentCta}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({
  destination,
  recovering: startRecovering = false,
}: {
  destination: string;
  /**
   * Abrir ya en modo «Recuperar». Solo lo pide «Pedir otro enlace», desde la
   * pantalla del enlace caducado: sin esto, ese botón dejaría al usuario en el
   * formulario de entrar buscando otra vez «¿Olvidaste tu contraseña?».
   */
  recovering?: boolean;
}) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const [mode, setMode] = useState<Mode>(
    startRecovering ? "recover" : "signIn",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const busy = status.kind === "submitting" || pending;
  const failure = status.kind === "failed" ? status.failure : null;
  const recovering = mode === "recover";
  /**
   * La pestaña activa, o `null` mientras se recupera.
   *
   * Es lo que evita `AUTH_COPY[mode as AuthTab]`: ese `as` reintroducía justo el
   * silencio que `AuthTab` existe para romper. Con una constante estrechada,
   * TypeScript sabe dentro del bloque que aquí no hay modo «recover», y el día
   * que aparezca un modo nuevo lo dice él.
   */
  const tab: AuthTab | null = mode === "recover" ? null : mode;
  /** Recuperar es su propia acción: falla en otro sitio y se explica distinto. */
  const action: AuthAction = recovering ? "resetRequest" : mode;
  /** Empty: sin nada escrito el CTA se ve inerte, pero no se deshabilita. */
  const empty =
    email.trim() === "" ||
    (!recovering &&
      (password === "" || (mode === "signUp" && confirm === "")));

  function switchTo(next: Mode) {
    setMode(next);
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

    // Cada modo manda SOLO los campos que tiene en pantalla: `validateCredentials`
    // juzga lo que recibe según la acción, así que colar una contraseña que no
    // se ha pedido sería inventarse un error que el usuario no puede ver.
    const trimmed = email.trim();
    const credentials: Credentials = recovering
      ? { email: trimmed }
      : {
          email: trimmed,
          password,
          ...(mode === "signUp" ? { confirm } : {}),
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
      if (recovering) {
        // Absoluta: el enlace del correo lo construye el proveedor desde su
        // propio dominio, así que una ruta relativa no le sirve de vuelta.
        const back = new URL(
          ROUTES.resetPassword,
          window.location.origin,
        ).toString();
        await auth.sendPasswordReset(trimmed, back);
        // Se muestra lo mismo pase lo que pase ahí dentro: el puerto promete
        // que esta llamada no distingue si la cuenta existe, y esta pantalla es
        // la otra mitad de esa promesa.
        setStatus({ kind: "resetSent", email: trimmed });
        return;
      }

      const forPort = { email: trimmed, password };
      if (mode === "signUp") {
        const { needsEmailVerification } = await auth.signUpWithEmail(forPort);
        // Si el proveedor NO exige confirmación, la cuenta ya está dentro y
        // mandarla a «revisa tu correo» sería mentir.
        if (needsEmailVerification) {
          setStatus({ kind: "sent", email: trimmed });
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

  if (status.kind === "sent" || status.kind === "resetSent") {
    return (
      <MailSent
        copy={
          status.kind === "sent"
            ? AUTH_COPY.mailSent.signUp
            : AUTH_COPY.mailSent.recover
        }
        email={status.email}
        onBack={() => switchTo("signIn")}
      />
    );
  }

  const copy = recovering ? AUTH_COPY.recover : AUTH_COPY[mode];
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
        {mode !== "signUp" ? (
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {recovering ? AUTH_COPY.recover.lead : AUTH_COPY.lead}
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

        {/* Ni pestañas ni Google mientras se recupera: son dos formas de entrar,
            y aquí todavía no se puede. Dejarlas invitaría a intentarlo con la
            contraseña que justamente no se recuerda. */}
        {tab ? (
          <>
            <div
              role="tablist"
              aria-label={AUTH_COPY.label}
              className="flex gap-1 rounded-full border border-border p-1"
            >
              {(["signIn", "signUp"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={mode === option}
                  onClick={() => switchTo(option)}
                  className={mode === option ? TAB_ON_CLASS : TAB_OFF_CLASS}
                >
                  {AUTH_COPY[option].tab}
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
              <span className={LABEL_CLASS}>
                {AUTH_COPY[tab].divider}
              </span>
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        {failure ? <Notice failure={failure} /> : null}

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField
            id={emailId}
            label={AUTH_COPY.emailLabel}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={AUTH_COPY.emailPlaceholder}
            value={email}
            onChange={setEmail}
            error={fields.email}
            disabled={busy}
          />

          {tab ? (
            <PasswordField
              id={passwordId}
              label={AUTH_COPY[tab].passwordLabel}
              autoComplete={
                tab === "signUp" ? "new-password" : "current-password"
              }
              value={password}
              onChange={setPassword}
              error={fields.password}
              hint={
                mode === "signUp"
                  ? AUTH_COPY.passwordHint(MIN_PASSWORD_LENGTH)
                  : undefined
              }
              visible={visible}
              onToggleVisible={() => setVisible((shown) => !shown)}
              disabled={busy}
            />
          ) : null}

          {/* El ojo es uno solo para los dos campos a propósito: al repetir una
              contraseña lo que quieres es compararlas, y eso pide verlas juntas. */}
          {mode === "signUp" ? (
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

          {/* Solo en «Entrar». En «Crear cuenta» ese hueco lo ocupa el campo de
              repetir, y ofrecerle recuperar la contraseña a quien todavía no
              tiene cuenta no significa nada. */}
          {mode === "signIn" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => switchTo("recover")}
                className={`text-[13px] ${LINK_CLASS}`}
              >
                {AUTH_COPY.forgotPassword}
              </button>
            </div>
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

          {recovering ? (
            <button
              type="button"
              onClick={() => switchTo("signIn")}
              disabled={busy}
              className={`self-center text-[13px] ${LINK_CLASS} ${busy ? "opacity-45" : ""}`}
            >
              {AUTH_COPY.recover.back}
            </button>
          ) : null}
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
