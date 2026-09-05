/**
 * Lo que se comprueba ANTES de salir a la red.
 *
 * No sustituye al backend: el proveedor tiene la última palabra sobre qué
 * contraseña acepta, y este módulo no puede saberlo. Lo que evita es el viaje
 * inútil —y el `429` de Managed Better Auth cuando alguien insiste— por algo que
 * ya se veía desde aquí.
 *
 * Función pura y sin dependencias: se puede testear sola.
 */

import type { AuthAction } from "@/lib/auth/messages";

/**
 * Un mensaje en español por campo. Vacío significa que se puede enviar.
 *
 * Se indexa por campo y no es una lista para que el formulario pueda pintar el
 * error DEBAJO de su campo, que es lo que dice el boceto, en vez de amontonarlos
 * todos arriba.
 */
export type FieldErrors = {
  readonly email?: string;
  readonly password?: string;
  readonly confirm?: string;
};

/** Lo mínimo que exige el registro. Aparece también como pista en el formulario. */
export const MIN_PASSWORD_LENGTH = 8;

export type Credentials = {
  /** Ausente al fijar la contraseña nueva: ahí quien identifica es el token. */
  readonly email?: string;
  /** Ausente al pedir el enlace: ese formulario tiene un solo campo. */
  readonly password?: string;
  /**
   * La repetición, al crear cuenta y al fijar una contraseña nueva. Se compara
   * aquí y no en el proveedor porque el proveedor no la ve: es una comprobación
   * contra el dedo del usuario, no contra ninguna regla del backend.
   */
  readonly confirm?: string;
};

/**
 * Qué campos tiene el formulario de cada acción, y cuáles se pueden juzgar.
 *
 * Es una tabla y no una cadena de `if (action === …)` porque son cuatro
 * formularios distintos sobre los mismos tres campos, y la pregunta que hay que
 * poder contestar de un vistazo es «¿qué se comprueba aquí?». Con condiciones
 * sueltas, añadir la quinta acción obliga a releer la función entera para
 * descubrir en cuáles entra.
 *
 * `newPassword` no es «hay campo de contraseña», es «esta contraseña se está
 * creando AHORA»: solo entonces se puede exigir la longitud mínima. Al entrar,
 * la contraseña ya existe y la regla del proveedor pudo endurecerse después.
 */
const SHAPE: Record<
  AuthAction,
  {
    readonly email: boolean;
    readonly password: boolean;
    readonly confirm: boolean;
    readonly newPassword: boolean;
  }
> = {
  signIn: { email: true, password: true, confirm: false, newPassword: false },
  signUp: { email: true, password: true, confirm: true, newPassword: true },
  resetRequest: {
    email: true,
    password: false,
    confirm: false,
    newPassword: false,
  },
  resetPassword: {
    email: false,
    password: true,
    confirm: true,
    newPassword: true,
  },
};

/**
 * Forma mínima de un email: algo, una arroba, algo, y ningún espacio.
 *
 * Deliberadamente laxa. NO exige un punto en el dominio, porque `root@localhost`
 * es un email válido y exigirlo sería inventarse una regla que bloquea a alguien
 * que el backend habría aceptado. Lo que sí descarta es lo que no puede ser un
 * email en ningún caso: sin arroba, con dos, o con un hueco en medio.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/;

const MESSAGES = {
  emailMissing: "Escribe tu email.",
  emailShape: "Ese email no parece un email. Revisa que tenga una arroba.",
  passwordMissing: "Escribe tu contraseña.",
  passwordShort: `Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  confirmMissing: "Repite la contraseña.",
  confirmMismatch: "Las dos contraseñas no coinciden.",
} as const;

/**
 * Lo que se puede afirmar sin saber nada del proveedor, y nada más.
 *
 * La línea está en la certeza: un campo vacío o un email sin arroba se ven desde
 * aquí. «Tu contraseña necesita un símbolo» no: sería adivinar una regla que
 * Managed Better Auth quizá no aplica, y el usuario se comería un error por una
 * contraseña que el backend habría aceptado. Ese riesgo no lo compensa ahorrar
 * un viaje.
 *
 * Se comprueban los DOS campos antes de volver, en vez de cortar en el primer
 * fallo: el formulario pinta cada mensaje debajo de su campo, así que devolver
 * solo uno obligaría a enviar dos veces para ver los dos.
 */
export function validateCredentials(
  credentials: Credentials,
  action: AuthAction,
): FieldErrors {
  const shape = SHAPE[action];
  const errors: { email?: string; password?: string; confirm?: string } = {};
  // Un campo que ese formulario no tiene se lee como vacío, no como ausente: lo
  // que decide si se juzga es la tabla, y no si el llamante se acordó de pasarlo.
  const email = credentials.email ?? "";
  const password = credentials.password ?? "";

  if (shape.email) {
    if (email === "") errors.email = MESSAGES.emailMissing;
    else if (!EMAIL_SHAPE.test(email)) errors.email = MESSAGES.emailShape;
  }

  if (shape.password) {
    if (password === "") {
      errors.password = MESSAGES.passwordMissing;
    } else if (shape.newPassword && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = MESSAGES.passwordShort;
    }
  }

  // La repetición solo se compara cuando la contraseña en sí es válida: decirle
  // «no coinciden» a quien todavía no ha terminado de escribir la primera es
  // ruido.
  if (shape.confirm && !errors.password) {
    if (!credentials.confirm) errors.confirm = MESSAGES.confirmMissing;
    else if (credentials.confirm !== password) {
      errors.confirm = MESSAGES.confirmMismatch;
    }
  }

  return errors;
}
