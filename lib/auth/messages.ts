/**
 * De la taxonomía del puerto a lo que lee el usuario, en español.
 *
 * Existe porque los adaptadores propagan el texto del proveedor —Better Auth y
 * Supabase contestan en inglés— y el spec exige los errores de auth en español.
 * Así que la interfaz NO muestra `error.message`: mira la CATEGORÍA del error,
 * que es lo que el puerto promete estable, y escribe el mensaje ella.
 *
 * `retryable` sale de la misma taxonomía: `NetworkError` es la única categoría
 * que se arregla repitiendo la llamada (ver `lib/backend/ports/errors.ts`), y por
 * eso es la única en la que el botón cambia a «Reintentar».
 */

import {
  ConflictError,
  MissingEnvError,
  NetworkError,
  UnauthenticatedError,
} from "@/lib/backend/ports";

/** Qué estaba intentando el usuario. El mismo error se explica distinto. */
export type AuthAction = "signIn" | "signUp";

export type AuthFailure = {
  /** Una frase, la que va en negrita. */
  readonly title: string;
  /** Qué hacer al respecto. */
  readonly detail: string;
  /** Si repetir la misma llamada puede funcionar. */
  readonly retryable: boolean;
};

export function describeAuthFailure(
  error: unknown,
  action: AuthAction,
): AuthFailure {
  if (error instanceof NetworkError) {
    return {
      title: "Sin conexión con el backend.",
      detail: "No hemos podido comprobar tus datos. Vuelve a intentarlo.",
      retryable: true,
    };
  }

  if (error instanceof MissingEnvError) {
    // No es un fallo del usuario ni algo que reintentar: falta configuración, y
    // decirle «revisa tu contraseña» le haría perder el tiempo.
    return {
      title: "La aplicación no está configurada.",
      detail: `Falta ${error.key} en el entorno. Esto no lo arregla reintentar.`,
      retryable: false,
    };
  }

  if (error instanceof ConflictError) {
    return action === "signUp"
      ? {
          title: "Ese email ya tiene cuenta.",
          detail: "Cambia a «Entrar» y usa tu contraseña.",
          retryable: false,
        }
      : {
          title: "No hemos podido completar la operación.",
          detail:
            "Choca con una regla de la cuenta. Reintentar tal cual no la arregla.",
          retryable: false,
        };
  }

  if (error instanceof UnauthenticatedError) {
    return action === "signIn"
      ? {
          // Un solo mensaje para contraseña mala Y email sin confirmar, por el
          // mismo argumento con el que `NotFoundError` confunde «no existe» con
          // «no es tuyo»: separarlos le confirmaría a un atacante que ese email
          // está registrado.
          title: "Email o contraseña incorrectos.",
          detail:
            "Revísalos. Si acabas de registrarte, confirma primero el correo.",
          retryable: false,
        }
      : {
          title: "No hemos podido crear la cuenta.",
          detail:
            "El proveedor rechazó los datos. Revisa el email y la contraseña.",
          retryable: false,
        };
  }

  // Lo que no se reconoce no se reintenta y no se cita: el texto de un error
  // desconocido puede venir del proveedor, en inglés, o traer detalles internos.
  return {
    title: "Algo ha fallado.",
    detail:
      action === "signIn"
        ? "No hemos podido entrar. Vuelve a probar en un momento."
        : "No hemos podido crear la cuenta. Vuelve a probar en un momento.",
    retryable: false,
  };
}
