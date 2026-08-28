/**
 * El mensaje que se le enseña a una persona cuando algo falla.
 *
 * Existe porque el mismo `catch` estaba escrito a mano en cuatro sitios —el
 * provider y los tres diálogos—, y cuatro copias de una decisión de interfaz se
 * desincronizan en cuanto alguien toca una.
 *
 * No traduce ni clasifica: de eso se encarga la taxonomía del Proveedor de
 * Backend (`lib/backend/ports/errors.ts`), que ya construye sus mensajes en
 * español. Aquí solo se saca el texto de algo cuyo tipo es `unknown`, que es lo
 * único que un `catch` promete.
 *
 * Módulo puro y sin dependencias, igual que `lib/path.ts` y `lib/time.ts`: lo
 * consumen componentes de cliente y se prueba sin montar ninguno.
 */

/** Lo último que se enseña si ni siquiera hay un mensaje que enseñar. */
const FALLBACK = "Algo ha fallado. Vuelve a intentarlo.";

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message;

  // Un `throw "texto"` es legal en JavaScript y llega hasta aquí. Se enseña tal
  // cual en vez de descartarlo: casi siempre dice más que el genérico.
  if (typeof error === "string" && error.trim().length > 0) return error;

  return FALLBACK;
}
