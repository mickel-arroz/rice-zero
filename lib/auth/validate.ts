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
};

/** Lo mínimo que exige el registro. Aparece también como pista en el formulario. */
export const MIN_PASSWORD_LENGTH = 8;

export type Credentials = {
  readonly email: string;
  readonly password: string;
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
  const errors: { email?: string; password?: string } = {};

  if (credentials.email === "") errors.email = MESSAGES.emailMissing;
  else if (!EMAIL_SHAPE.test(credentials.email))
    errors.email = MESSAGES.emailShape;

  if (credentials.password === "") {
    errors.password = MESSAGES.passwordMissing;
  } else if (
    action === "signUp" &&
    credentials.password.length < MIN_PASSWORD_LENGTH
  ) {
    // Solo al CREAR. Al entrar, esa contraseña ya existe y la regla del
    // proveedor pudo endurecerse después: rechazarla aquí dejaría a su dueño
    // sin poder entrar nunca, y con un mensaje que además le echa la culpa.
    errors.password = MESSAGES.passwordShort;
  }

  return errors;
}
