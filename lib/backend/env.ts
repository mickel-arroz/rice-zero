/**
 * Lectura de variables de entorno para los adaptadores.
 *
 * Vive dentro de `lib/backend/` a propósito: los nombres de las variables son
 * detalle de cada proveedor, y cambiar de proveedor no debe tocar nada fuera de
 * este directorio.
 */

import { MissingEnvError } from "@/lib/backend/ports";

/**
 * Exige un valor no vacío. Nunca incluye el valor recibido en el error: una
 * variable mal copiada puede ser un secreto y los errores acaban en logs.
 *
 * `hint` es la frase que dice cómo conseguirlo — el wizard del proveedor.
 */
export function requireEnv(
  key: string,
  value: string | undefined,
  hint?: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new MissingEnvError(key, hint);
  return trimmed;
}
