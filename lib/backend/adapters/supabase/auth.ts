/**
 * `AuthProvider` sobre Supabase Auth.
 *
 * Traduce a la taxonomía del puerto y nada más: la app no ve un `AuthError` de
 * Supabase en ningún sitio.
 */

import type { AuthError, Session } from "@supabase/supabase-js";

import { keepBackendError } from "@/lib/backend/adapters/postgrest/errors";
import type { SupabaseBrowserClient } from "@/lib/backend/adapters/supabase/client";
import {
  ConflictError,
  NetworkError,
  UnauthenticatedError,
  type AuthProvider,
  type AuthSession,
} from "@/lib/backend/ports";

/** Códigos con los que Supabase dice «ese email ya está registrado». */
const ALREADY_REGISTERED = new Set(["user_already_exists", "email_exists"]);

function toAuthSession(session: Session): AuthSession {
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      emailVerified: session.user.email_confirmed_at != null,
    },
  };
}

function translateAuthError(error: AuthError): Error {
  if (error.code && ALREADY_REGISTERED.has(error.code)) {
    return new ConflictError("email-registrado", "Ese email ya tiene cuenta.", {
      cause: error,
    });
  }
  // Un 5xx o un fallo de red llegan también como AuthError; se distinguen por
  // el status, que en los errores de credenciales es 4xx. El 429 va con ellos
  // aunque sea 4xx: «espera» es transitorio y se reintenta, mientras que
  // tratarlo como falta de sesión mandaría a login a quien solo tiene que
  // esperar. Lo destapó la corrida en vivo, con 45 logins seguidos.
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
        throw keepBackendError(error);
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
        throw keepBackendError(error);
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
        throw keepBackendError(error);
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) throw translateAuthError(error);
      } catch (error) {
        throw keepBackendError(error);
      }
    },
  };
}
