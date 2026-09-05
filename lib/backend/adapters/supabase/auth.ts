/**
 * `AuthProvider` sobre Supabase Auth.
 *
 * Traduce a la taxonomía del puerto y nada más: la app no ve un `AuthError` de
 * Supabase en ningún sitio.
 */

import {
  isAuthError,
  isAuthRetryableFetchError,
  type AuthError,
  type Session,
} from "@supabase/supabase-js";

import { keepBackendError } from "@/lib/backend/adapters/postgrest/errors";
import type { SupabaseBrowserClient } from "@/lib/backend/adapters/supabase/client";
import {
  ConflictError,
  NetworkError,
  RESET_TOKEN_RULE,
  UnauthenticatedError,
  type AuthProvider,
  type AuthSession,
} from "@/lib/backend/ports";

/** Códigos con los que Supabase dice «ese email ya está registrado». */
const ALREADY_REGISTERED = new Set(["user_already_exists", "email_exists"]);

/**
 * Códigos con los que Supabase rechaza el enlace de recuperación.
 *
 * Aquí el «token» es el `code` de PKCE que trae la URL del correo, así que un
 * enlace ya usado vuelve como intercambio fallido y no como token expirado. Los
 * tres son la misma frase para el usuario: pide otro enlace.
 */
const BAD_RESET_TOKEN = new Set([
  "otp_expired",
  "flow_state_expired",
  "flow_state_not_found",
]);

/**
 * La traducción de `resetPassword`, y SOLO de ella.
 *
 * Va aparte de la general por lo mismo que en el adaptador de Neon: dentro de
 * esta operación el único token en juego es el del correo, y fuera de ella esos
 * códigos hablarían de otra cosa. Que los dos adaptadores tengan la misma forma
 * no es estética — es lo que hace que el interruptor del ADR 0001 se pueda
 * accionar sin releer los dos archivos.
 */
function translateResetFailure(error: AuthError): Error {
  if (error.code && BAD_RESET_TOKEN.has(error.code)) {
    return new ConflictError(
      RESET_TOKEN_RULE,
      "Ese enlace de recuperación ya no vale.",
      { cause: error },
    );
  }
  return translateAuthError(error);
}

function toAuthSession(session: Session): AuthSession {
  // Supabase no normaliza el perfil social: nombre y foto llegan dentro de
  // `user_metadata` con las claves que puso el proveedor. Se leen las dos
  // grafías que usa Google porque son las que este proyecto puede recibir.
  const meta = session.user.user_metadata as Record<string, unknown> | null;
  const text = (key: string) =>
    typeof meta?.[key] === "string" && meta[key] ? (meta[key] as string) : null;

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      emailVerified: session.user.email_confirmed_at != null,
      name: text("full_name") ?? text("name"),
      image: text("avatar_url") ?? text("picture"),
    },
  };
}

/**
 * El SDK puede LANZAR su error en vez de devolverlo en `error`. Sin este filtro
 * acababa en `translateThrown` y salía como `NetworkError` —reintentable—, así
 * que la interfaz habría ofrecido «reintentar» ante una contraseña mal escrita.
 *
 * Es el mismo agujero que la corrida en vivo destapó en el adaptador de Neon.
 * Aquí se cierra por simetría y sin esperar a que alguien accione el
 * interruptor: un adaptador dormido que solo es correcto a medias no sirve de
 * plan B.
 */
function translateThrownAuth(error: unknown): Error {
  return isAuthError(error) ? translateAuthError(error) : keepBackendError(error);
}

function translateAuthError(error: AuthError): Error {
  if (error.code && ALREADY_REGISTERED.has(error.code)) {
    return new ConflictError("email-registrado", "Ese email ya tiene cuenta.", {
      cause: error,
    });
  }
  // El SDK ya sabe qué es reintentable, así que no hay que deducirlo: este
  // guard cubre el `fetch` que falla, el timeout y el DNS.
  if (isAuthRetryableFetchError(error)) {
    return new NetworkError(error.message, { cause: error });
  }
  // Y el resto por status. El 429 va con los 5xx aunque sea 4xx: «espera» es
  // transitorio y se reintenta, mientras que tratarlo como falta de sesión
  // mandaría a login a quien solo tiene que esperar. Lo destapó la corrida en
  // vivo del otro adaptador, con 45 logins seguidos.
  if (error.status === 429 || (error.status != null && error.status >= 500)) {
    return new NetworkError(error.message, { cause: error });
  }
  return new UnauthenticatedError(error.message, { cause: error });
}

export function createSupabaseAuthProvider(
  client: SupabaseBrowserClient,
): AuthProvider {
  async function currentSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) return null;
      return toAuthSession(data.session);
    } catch {
      // El puerto promete que esto no lanza: sin sesión legible, no hay sesión.
      return null;
    }
  }

  return {
    currentSession,

    async requireSession(): Promise<AuthSession> {
      const session = await currentSession();
      if (!session) throw new UnauthenticatedError();
      return session;
    },

    async signUpWithEmail({ email, password }) {
      try {
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw translateAuthError(error);
        // Sin sesión tras registrarse = hay que confirmar el email, que es el
        // caso normal: el spec exige verificación obligatoria.
        return { needsEmailVerification: data.session === null };
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async signInWithEmail({ email, password }) {
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw translateAuthError(error);
        if (!data.session) throw new UnauthenticatedError();
        return toAuthSession(data.session);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async signInWithGoogle(redirectTo) {
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) throw translateAuthError(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async sendPasswordReset(email, redirectTo) {
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw translateAuthError(error);
        // Supabase tampoco distingue si el email existe: contesta lo mismo en
        // los dos casos, y aquí no se añade ninguna comprobación que lo rompa.
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async resetPassword(token, newPassword) {
      try {
        // En Supabase el «token» del puerto es el `code` de PKCE que trae la URL
        // del correo, y hay que canjearlo por una sesión ANTES de poder cambiar
        // la contraseña: `updateUser` actúa sobre el usuario de la sesión, no
        // sobre un id suelto. Es el paso que Better Auth no necesita, y por eso
        // vive aquí y no en el puerto.
        const exchanged = await client.auth.exchangeCodeForSession(token);
        if (exchanged.error) throw translateResetFailure(exchanged.error);

        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw translateResetFailure(error);

        // Y se cierra, sin condición. No hay ninguna sesión ajena que proteger:
        // `exchangeCodeForSession` ya SUSTITUYÓ la que hubiera por la del dueño
        // del enlace, así que para cuando se llega aquí la anterior se perdió en
        // el canje, no en este `signOut`.
        //
        // El puerto promete que esto NO deja sesión abierta, y
        // Supabase sí la deja: sin esto los dos adaptadores acabarían en
        // pantallas distintas —uno en /projects, otro en el formulario de
        // entrar— con el mismo código de interfaz encima.
        await client.auth.signOut();
      } catch (error) {
        throw isAuthError(error) ? translateResetFailure(error) : keepBackendError(error);
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) throw translateAuthError(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },
  };
}
