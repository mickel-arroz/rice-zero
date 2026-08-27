/**
 * `AuthProvider` sobre Managed Better Auth (Neon Auth).
 *
 * Traduce a la taxonomía del puerto y nada más: la app no ve un error de Better
 * Auth en ningún sitio. Es también la mitigación que el ADR pide por que el
 * servicio esté en Beta — si se rompe, este archivo es el único a tocar.
 */

import { translateThrown } from "@/lib/backend/adapters/postgrest/errors";
import type { NeonBrowserClient } from "@/lib/backend/adapters/neon/client";
import {
  BackendError,
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
  if (failure.status != null && failure.status >= 500) {
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
        // Sin usuario devuelto no hay nada que confirmar, así que se trata
        // como el caso normal: hay que verificar el email antes de entrar.
        return { needsEmailVerification: !(data as { user?: unknown })?.user };
      } catch (error) {
        throw rethrow(error);
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
        throw rethrow(error);
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
        throw rethrow(error);
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw rethrow(error);
      }
    },
  };
}

/**
 * Deja pasar lo que ya es un error del puerto y envuelve lo demás.
 *
 * Los `catch` de arriba están para el `fetch` que rechaza, no para el error que
 * ellos mismos acaban de lanzar; sin este filtro se lo comerían y lo
 * reetiquetarían como fallo de red.
 */
function rethrow(error: unknown): Error {
  return error instanceof BackendError ? error : translateThrown(error);
}
