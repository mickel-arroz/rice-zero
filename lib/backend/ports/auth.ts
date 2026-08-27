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
  signOut(): Promise<void>;
}
