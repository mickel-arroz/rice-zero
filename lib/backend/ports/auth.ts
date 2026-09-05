/**
 * El puerto de autenticación.
 *
 * Va dentro del Proveedor de Backend, no al lado: el objetivo es un solo
 * interruptor. El precio, aceptado en el ADR, es que las cuentas de usuario no
 * viajan al cambiar de adaptador.
 */

import type { AuthSession } from "@/lib/backend/ports/entities";

export type EmailCredentials = {
  email: string;
  password: string;
};

export type SignUpResult = {
  /**
   * `true` cuando la cuenta quedó creada pero aún no se puede entrar. Es el
   * caso normal: el spec exige verificación de email obligatoria.
   */
  needsEmailVerification: boolean;
};

export interface AuthProvider {
  /** La sesión actual, o `null` si no hay ninguna. No lanza. */
  currentSession(): Promise<AuthSession | null>;
  /** @throws UnauthenticatedError si no hay sesión. */
  requireSession(): Promise<AuthSession>;
  /** @throws ConflictError si el email ya está registrado. */
  signUpWithEmail(credentials: EmailCredentials): Promise<SignUpResult>;
  /** @throws UnauthenticatedError con credenciales malas o email sin verificar. */
  signInWithEmail(credentials: EmailCredentials): Promise<AuthSession>;
  /**
   * Arranca el flujo de Google. No devuelve sesión: redirige al proveedor y la
   * sesión aparece al volver a `redirectTo`.
   */
  signInWithGoogle(redirectTo: string): Promise<void>;
  /**
   * Manda el correo con el enlace para poner una contraseña nueva.
   *
   * **No revela si el email existe.** Es el mismo argumento con el que
   * `NotFoundError` confunde «no existe» con «no es tuyo»: contestar distinto
   * —un error, un silencio más corto, cualquier cosa— le confirma a un atacante
   * que esa cuenta está registrada. Así que esto NO lanza por un email
   * desconocido; solo por lo que impide mandar el correo en cualquier caso
   * (sin red, sin configuración).
   *
   * @param redirectTo absoluta: a dónde vuelve el usuario desde el correo. El
   *   proveedor le añade el token, así que es la ruta de reset a secas.
   * @throws NetworkError sin red o con el proveedor caído.
   * @throws MissingEnvError si falta configuración.
   */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  /**
   * Fija la contraseña nueva a cambio del token que venía en el correo.
   *
   * No deja sesión abierta: el token prueba que se controla el buzón, no que
   * la cuenta pueda actuar (`canAct` sigue exigiendo el email confirmado, y
   * esta operación NO lo confirma). Después hay que entrar como siempre.
   *
   * @throws ConflictError con `rule` `token-caducado` si el token caducó, ya se
   *   usó o nunca existió — las tres son el mismo resultado y reintentar no
   *   arregla ninguna.
   */
  resetPassword(token: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
}

/**
 * La regla que viola un token de recuperación que ya no vale.
 *
 * Es una constante y no un texto suelto porque la escriben los tres adaptadores
 * y la lee `describeAuthFailure`: un `ConflictError` cuyo `rule` no coincide se
 * traduce al mensaje genérico sin que nada falle.
 */
export const RESET_TOKEN_RULE = "token-caducado";

/**
 * Con qué nombre viaja el token en la URL a la que vuelve el correo.
 *
 * Son DOS porque cada proveedor le pone el suyo: Managed Better Auth redirige
 * con `?token=`, y Supabase con el `?code=` de PKCE. Vive aquí, del lado del
 * puerto, por lo mismo que `needsGateOnPublicPath` existe en `session.ts`: el
 * nombre del parámetro es detalle del proveedor, y una página que conociera los
 * dos invertiría el límite del ADR 0001.
 *
 * El orden no importa: los proveedores no comparten nombre, así que en una URL
 * real solo puede haber uno.
 */
const RESET_TOKEN_PARAMS = ["token", "code"] as const;

/**
 * El token de recuperación que trae esta URL, o `null` si no trae ninguno.
 *
 * Función pura, como `canAct`: la llama la ruta de reset para saber si tiene
 * algo con lo que trabajar. `null` cubre los TRES casos en los que no lo tiene
 * —el proveedor redirigió con `?error=`, alguien entró a mano, o el parámetro
 * llegó vacío— y los tres se pintan igual, porque para el usuario son el mismo:
 * ese enlace no vale y hay que pedir otro.
 */
export function resetTokenFrom(params: URLSearchParams): string | null {
  for (const name of RESET_TOKEN_PARAMS) {
    const value = params.get(name);
    if (value) return value;
  }
  return null;
}
