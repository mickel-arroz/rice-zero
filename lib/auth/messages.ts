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
  RESET_TOKEN_RULE,
  UnauthenticatedError,
} from "@/lib/backend/ports";
import { AUTH_COPY } from "@/lib/constants";

/**
 * Qué estaba intentando el usuario. El mismo error se explica distinto.
 *
 * Las dos de recuperación son acciones separadas y no una porque fallan en
 * sitios distintos: `resetRequest` es pedir el correo —y ahí no se puede decir
 * nada sobre la cuenta—, mientras que `resetPassword` es canjear el token, que
 * es lo único que puede caducar.
 */
export type AuthAction =
  | "signIn"
  | "signUp"
  | "resetRequest"
  | "resetPassword";

/**
 * Las dos acciones que además son PESTAÑA del formulario de acceso.
 *
 * Existe porque `AUTH_COPY` se indexa por ellas —`AUTH_COPY[tab].submit`— y las
 * otras dos no son pestañas de nada: recuperar es un modo del mismo card, y
 * fijar la contraseña vive en otra ruta. Sin este tipo, añadir una acción a la
 * unión rompía ese acceso en silencio.
 */
export type AuthTab = Extract<AuthAction, "signIn" | "signUp">;

export type AuthFailure = {
  /** Una frase, la que va en negrita. */
  readonly title: string;
  /** Qué hacer al respecto. */
  readonly detail: string;
  /** Si repetir la misma llamada puede funcionar. */
  readonly retryable: boolean;
};

/**
 * El enlace de recuperación que ya no vale.
 *
 * Es una constante exportada y no un objeto suelto dentro del `if` porque tiene
 * DOS orígenes que deben leerse idénticos: el proveedor rechazando el token, y
 * la ruta de reset abriéndose sin ninguno —porque el correo redirigió con
 * `?error=`, o porque alguien entró a mano—. Para quien lo lee son el mismo
 * suceso, así que tienen que ser el mismo texto.
 *
 * El texto en sí viene de `AUTH_COPY` y no está escrito aquí: es lo ÚNICO de
 * este archivo que se pinta como estado de pantalla y no como traducción de un
 * fallo, y «los errores y los estados en español» es un criterio que solo se
 * puede revisar si la copy está en un sitio.
 */
export const RESET_LINK_EXPIRED: AuthFailure = {
  title: AUTH_COPY.reset.expiredNotice,
  detail: AUTH_COPY.reset.expiredDetail,
  retryable: false,
};

/**
 * ¿Este fallo es un enlace de recuperación agotado?
 *
 * La pregunta la contesta este módulo y no la pantalla para que el `rule` —lo
 * único que el puerto promete estable de un `ConflictError`— no se compare en
 * dos sitios. La interfaz solo necesita el sí o el no, porque de él depende algo
 * más grande que un texto: si pinta el formulario o la salida.
 */
export function isExpiredResetLink(error: unknown): boolean {
  return error instanceof ConflictError && error.rule === RESET_TOKEN_RULE;
}

/**
 * Lo que se estaba intentando, en la frase que va tras «No hemos podido».
 *
 * Es un `Record` completo y no un `switch` con `default` a propósito: así, el
 * día que la unión gane una acción, el typecheck señala este objeto en vez de
 * dejar que el caso nuevo herede en silencio un texto que habla de otra cosa.
 */
const ATTEMPT: Record<AuthAction, string> = {
  signIn: "comprobar tus datos",
  signUp: "crear la cuenta",
  resetRequest: "enviar el correo",
  resetPassword: "guardar la contraseña",
};

export function describeAuthFailure(
  error: unknown,
  action: AuthAction,
): AuthFailure {
  if (error instanceof NetworkError) {
    return {
      title: "Sin conexión con el backend.",
      detail: `No hemos podido ${ATTEMPT[action]}. Vuelve a intentarlo.`,
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
    // Se mira `rule` y no la acción: es lo que el puerto promete estable, y los
    // tres adaptadores escriben la misma constante. Un ConflictError con otra
    // regla NO puede acabar diciendo «pide otro enlace», porque pedirlo no
    // arreglaría nada.
    if (error.rule === RESET_TOKEN_RULE) return RESET_LINK_EXPIRED;

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
    return REJECTED[action];
  }

  // Lo que no se reconoce no se reintenta y no se cita: el texto de un error
  // desconocido puede venir del proveedor, en inglés, o traer detalles internos.
  return {
    title: "Algo ha fallado.",
    detail: `No hemos podido ${ATTEMPT[action]}. Vuelve a probar en un momento.`,
    retryable: false,
  };
}

/**
 * Lo que se dice cuando el proveedor rechaza la operación en sí.
 *
 * Ninguna de las cuatro habla de si esa cuenta existe. Al entrar es un solo
 * mensaje para contraseña mala Y email sin confirmar; al pedir el enlace no se
 * menciona la cuenta en absoluto — y ese es justo el criterio del ticket, porque
 * un texto distinto para «ese email no está» convertiría un fallo cualquiera en
 * una forma de preguntar quién tiene cuenta aquí.
 */
const REJECTED: Record<AuthAction, AuthFailure> = {
  signIn: {
    // Por el mismo argumento con el que `NotFoundError` confunde «no existe»
    // con «no es tuyo»: separarlos le confirmaría a un atacante que ese email
    // está registrado.
    title: "Email o contraseña incorrectos.",
    detail: "Revísalos. Si acabas de registrarte, confirma primero el correo.",
    retryable: false,
  },
  signUp: {
    title: "No hemos podido crear la cuenta.",
    detail: "El proveedor rechazó los datos. Revisa el email y la contraseña.",
    retryable: false,
  },
  resetRequest: {
    // «Revisa el email» sobraba: en el formulario cuyo criterio es contestar lo
    // mismo exista o no la cuenta, esa frase se lee como «ese email no vale» —
    // que es exactamente lo que no se puede insinuar.
    title: "No hemos podido enviar el correo.",
    detail: "El proveedor rechazó la petición. Vuelve a probar en un momento.",
    retryable: false,
  },
  resetPassword: {
    title: "No hemos podido guardar la contraseña.",
    detail: "Vuelve a abrir el enlace del correo o pide uno nuevo.",
    retryable: false,
  },
};
