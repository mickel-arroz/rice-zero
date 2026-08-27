/**
 * `AuthProvider` sobre Managed Better Auth (Neon Auth).
 *
 * Traduce a la taxonomía del puerto y nada más: la app no ve un error de Better
 * Auth en ningún sitio. Es también la mitigación que el ADR pide por que el
 * servicio esté en Beta — si se rompe, este archivo es el único a tocar.
 */

import { isAuthApiError } from "@neondatabase/auth";

import { keepBackendError } from "@/lib/backend/adapters/postgrest/errors";
import type { NeonBrowserClient } from "@/lib/backend/adapters/neon/client";
import {
  ConflictError,
  NetworkError,
  UnauthenticatedError,
  type AuthProvider,
  type AuthSession,
} from "@/lib/backend/ports";

/** Códigos con los que Better Auth dice «ese email ya está registrado». */
const ALREADY_REGISTERED = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

/** El error de Better Auth, reducido a lo que se mira. */
type BetterAuthFailure = {
  message?: string;
  status?: number;
  code?: string;
};

/**
 * El SDK no siempre devuelve el fallo en `error`: en varios caminos LANZA un
 * `AuthApiError`, y por ahí pasan las credenciales incorrectas y el email ya
 * registrado. Sin este filtro acababan en `translateThrown` y se reportaban
 * como `NetworkError` —o sea, reintentables—, así que la interfaz habría
 * ofrecido «reintentar» ante una contraseña mal escrita.
 *
 * Lo descubrió la corrida en vivo: un 403 del servicio de auth llegaba a la app
 * como un problema de red.
 */
function translateThrownAuth(error: unknown): Error {
  return isAuthApiError(error)
    ? translateAuthFailure(error as BetterAuthFailure)
    : keepBackendError(error);
}

/** El usuario de Better Auth, reducido a lo que el puerto expone. */
type BetterAuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
};

function toAuthSession(user: BetterAuthUser): AuthSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    },
  };
}

function translateAuthFailure(failure: BetterAuthFailure): Error {
  const message = failure.message ?? "Fallo de autenticación.";

  if (failure.code && ALREADY_REGISTERED.has(failure.code)) {
    return new ConflictError("email-registrado", "Ese email ya tiene cuenta.", {
      cause: failure,
    });
  }
  // El 429 va con los 5xx aunque sea 4xx: «espera» es transitorio y se
  // reintenta, mientras que tratarlo como falta de sesión mandaría a login a
  // quien solo tiene que esperar. Lo destapó la corrida en vivo, con 45 logins
  // seguidos.
  if (failure.status === 429 || (failure.status != null && failure.status >= 500)) {
    return new NetworkError(message, { cause: failure });
  }
  return new UnauthenticatedError(message, { cause: failure });
}

/**
 * Better Auth exige un nombre al registrarse y el puerto solo pide email y
 * contraseña, porque el nombre no es parte del dominio de RICE(0) — no aparece
 * en `CONTEXT.md`. Se usa la parte local del email como valor de arranque; el
 * ticket de auth (#7) es el que decide si se le pide al usuario.
 */
function nameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}

export function createNeonAuthProvider(client: NeonBrowserClient): AuthProvider {
  async function currentSession(): Promise<AuthSession | null> {
    try {
      const { data } = await client.auth.getSession();
      const user = data?.user as BetterAuthUser | undefined;
      return user ? toAuthSession(user) : null;
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
        const { data, error } = await client.auth.signUp.email({
          email,
          password,
          name: nameFromEmail(email),
        });
        if (error) throw translateAuthFailure(error);
        // Better Auth devuelve el usuario TAMBIÉN cuando hay que confirmar el
        // email, así que mirarlo daba siempre «no hace falta confirmar». Lo que
        // separa los dos casos es la sesión: con verificación obligatoria el
        // `token` viene nulo y el usuario sin verificar. Comprobado contra el
        // servicio real, que devuelve `{ token: null, user: { emailVerified:
        // false, … } }`.
        const created = data as {
          token?: string | null;
          user?: { emailVerified?: boolean };
        } | null;
        return {
          needsEmailVerification:
            !created?.token || created.user?.emailVerified !== true,
        };
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async signInWithEmail({ email, password }) {
      try {
        const { data, error } = await client.auth.signIn.email({
          email,
          password,
        });
        if (error) throw translateAuthFailure(error);
        const user = (data as { user?: BetterAuthUser } | null)?.user;
        if (!user) throw new UnauthenticatedError();
        // El spec exige verificación obligatoria. Better Auth la aplica con
        // `requireEmailVerification` en el servidor; esto es el cinturón de
        // seguridad por si ese toggle se apaga en la consola de Neon.
        if (!user.emailVerified) {
          throw new UnauthenticatedError(
            "Confirma tu email antes de entrar. Te hemos reenviado el correo.",
          );
        }
        return toAuthSession(user);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async signInWithGoogle(redirectTo) {
      try {
        const { error } = await client.auth.signIn.social({
          provider: "google",
          callbackURL: redirectTo,
        });
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },
  };
}
