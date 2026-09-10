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
  RESET_TOKEN_RULE,
  UnauthenticatedError,
  type AuthProvider,
  type AuthSession,
} from "@/lib/backend/ports";

/** Códigos con los que Better Auth dice «ese email ya está registrado». */
const ALREADY_REGISTERED = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

/**
 * Códigos con los que llega un token de recuperación que ya no vale.
 *
 * Son DOS porque hay DOS capas y el código cambia al pasar de una a la otra.
 * Better Auth contesta `400 {"code":"INVALID_TOKEN"}` —comprobado contra el
 * servicio real— pero el SDK de Neon lo NORMALIZA antes de que la app lo vea:
 * su `BETTER_AUTH_ERROR_MAP` convierte `INVALID_TOKEN` en `bad_jwt`, le pone un
 * 401 y reescribe el mensaje como «Invalid or expired session token». Lo que
 * llega aquí es siempre lo segundo; lo primero se deja por si el SDK deja de
 * normalizar, que es justo el cambio que nadie anunciaría.
 *
 * Lo destapó la corrida E2E contra el proveedor de verdad: con el mapeo hecho
 * solo sobre `INVALID_TOKEN`, un enlace caducado salía como «no hemos podido
 * guardar la contraseña» y el usuario se quedaba mirando un formulario que
 * nunca iba a funcionar, sin que nada le dijera que pidiera otro enlace.
 */
const BAD_RESET_TOKEN = new Set(["bad_jwt", "INVALID_TOKEN"]);

/**
 * La traducción de `resetPassword`, y SOLO de ella.
 *
 * `bad_jwt` no puede vivir en la traducción general: es también lo que contesta
 * una sesión caducada de verdad, y ahí «pide otro enlace de recuperación» no
 * tendría ningún sentido. Dentro de esta operación, en cambio, el único token
 * en juego es el del correo.
 */
function translateResetFailure(failure: BetterAuthFailure): Error {
  if (failure.code && BAD_RESET_TOKEN.has(failure.code)) {
    return new ConflictError(
      RESET_TOKEN_RULE,
      "Ese enlace de recuperación ya no vale.",
      { cause: failure },
    );
  }
  return translateAuthFailure(failure);
}

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
  name?: string | null;
  image?: string | null;
};

function toAuthSession(user: BetterAuthUser): AuthSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name ?? null,
      image: user.image ?? null,
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
  if (
    failure.status === 429 ||
    (failure.status != null && failure.status >= 500)
  ) {
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

export function createNeonAuthProvider(
  client: NeonBrowserClient,
): AuthProvider {
  /*
   * Aquí había un `forget()` que tiraba el JWT cacheado al entrar y al salir,
   * porque un token del usuario anterior serviría para leer sus Proyectos.
   * Desde el ADR 0006 no hace falta y no puede hacer falta: en el navegador ya
   * no hay ningún token. El caché vive en el servidor y su clave es la COOKIE
   * de sesión, así que una sesión nueva es una clave nueva y falla sola — la
   * garantía dejó de depender de que alguien se acordara de invalidar.
   */

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
          // La MISMA URL, y no es redundante: Better Auth decide el destino con
          //
          //     result.isRegister ? newUserURL || callbackURL : callbackURL
          //
          // así que la PRIMERA vez —la que crea la cuenta— usa una URL distinta.
          // Sin mandarla, Neon pone la suya por defecto (la Site URL de la
          // consola, que es la raíz) y el consentimiento inicial acababa en `/`
          // en vez de donde el usuario iba. Los intentos siguientes «funcionaban»
          // por otro motivo: ya había sesión de la primera vez.
          newUserCallbackURL: redirectTo,
        });
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async sendPasswordReset(email, redirectTo) {
      try {
        // Better Auth ya contesta lo mismo exista o no la cuenta: cuando el
        // email no está, genera un id que tira y consulta una verificación
        // inventada —mitigación de ataque por tiempos— y devuelve el MISMO
        // `200`. Así que aquí no hay nada que ocultar; lo que hay que hacer es
        // no romperlo, y por eso ningún camino de abajo mira si el usuario
        // existe.
        const { error } = await client.auth.requestPasswordReset({
          email,
          redirectTo,
        });
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },

    async resetPassword(token, newPassword) {
      try {
        const { error } = await client.auth.resetPassword({
          token,
          newPassword,
        });
        if (error) throw translateResetFailure(error);
        // NO se abre sesión ni se toca `emailVerified`: el endpoint solo cambia
        // el hash de la contraseña. Una cuenta sin confirmar sigue chocando con
        // `canAct` después de esto, y la interfaz lo dice.
      } catch (error) {
        // El SDK LANZA por este camino —lo hace de verdad, no en teoría—, así
        // que la traducción específica tiene que estar en los dos sitios.
        throw isAuthApiError(error)
          ? translateResetFailure(error as BetterAuthFailure)
          : keepBackendError(error);
      }
    },

    async signOut() {
      // Antes de la llamada y no después: si el servicio falla, la sesión local
      // queda en un estado que no controlamos, y el token cacheado es lo último
      // que debe sobrevivir a eso.
      try {
        const { error } = await client.auth.signOut();
        if (error) throw translateAuthFailure(error);
      } catch (error) {
        throw translateThrownAuth(error);
      }
    },
  };
}
