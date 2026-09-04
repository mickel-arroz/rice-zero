/**
 * Las dos decisiones del Panel de IA que no son cableado de React: cuándo se
 * puede reintentar, y qué dice la puerta de la cabecera.
 *
 * Mismo criterio que `components/tree/autosave.ts`: lo que tiene una DECISIÓN
 * dentro se saca a funciones puras para poder comprobarlo sin montar un
 * componente. Lo demás —el `setInterval` de la cuenta atrás, el estado de la
 * hoja, el foco— es cableado y vive en el provider.
 *
 * Módulo puro: no importa React ni toca red.
 */

import type { AnalysisFailure } from "@/lib/ai";

/* ── Reintentar ─────────────────────────────────────────────────────────── */

export type RetryPlan =
  /** Se puede volver a pulsar ya. */
  | { kind: "ahora" }
  /** Todavía no: quedan estos segundos. Nunca cero — a cero es «ahora». */
  | { kind: "espera"; seconds: number }
  /** Reintentar no arregla nada. Lo que hay que cambiar es otra cosa. */
  | { kind: "nunca" };

/**
 * ¿Tiene sentido volver a pulsar «Generar», y cuándo?
 *
 * Existe porque el ticket y la taxonomía dicen cosas que PARECEN incompatibles:
 * `QuotaExceededError.retryable` es `false` y el criterio de aceptación pide
 * «toast + reintento» justo para el 429. Las dos son ciertas a la vez, y esta
 * función es donde se ve por qué: `retryable: false` significa «no AHORA, y
 * repetirlo no cambia nada», no «nunca más». Lo que convierte ese «no ahora»
 * en un botón usable es `retryAfterSeconds`, que el adaptador ya extrae del
 * 429 y que hasta hoy no leía nadie.
 *
 * Así que la regla es: quien se declara reintentable, ya; la cuota, cuando el
 * proveedor diga —o ya mismo si no dijo nada—; y el resto, no, porque un botón
 * que no puede funcionar es peor que no tener botón. Ahí el criterio de
 * aceptación manda sobre lo que se deduciría de `retryable` a secas: el ticket
 * pide reintento para el 429, y el 429 lo tiene siempre.
 *
 * @param elapsedSeconds cuánto hace que falló. Entra como parámetro y no se lee
 *   un reloj aquí dentro para que la función siga siendo pura y la cuenta atrás
 *   se pueda probar sin esperar treinta y ocho segundos.
 */
export function retryPlan(
  failure: AnalysisFailure,
  elapsedSeconds: number,
): RetryPlan {
  if (failure.retryable) return { kind: "ahora" };

  // Las tres categorías que no son la cuota —falta configuración, no hay
  // sesión, la entrada no vale— no mejoran por insistir: lo que hay que
  // cambiar es otra cosa, y un botón ahí solo distrae de cuál.
  if (failure.kind !== "cuota") return { kind: "nunca" };

  // Cuota sin plazo: se ofrece reintentar sin cuenta atrás. No hay número que
  // enseñar, pero tampoco motivo para dejar a nadie sin salida — el mensaje
  // del error ya dice «vuelve a intentarlo más tarde».
  if (failure.retryAfterSeconds === null) return { kind: "ahora" };

  const left = failure.retryAfterSeconds - elapsedSeconds;
  // Hacia arriba: un botón que se enciende medio segundo antes de que el
  // proveedor lo acepte gasta una llamada del free tier para que la rechacen.
  return left > 0 ? { kind: "espera", seconds: Math.ceil(left) } : { kind: "ahora" };
}

/* ── La puerta ──────────────────────────────────────────────────────────── */

/**
 * Qué dice el botón de la cabecera que abre la hoja.
 *
 * Es la puerta del panel y a la vez su único indicador cuando la hoja está
 * cerrada, que es exactamente lo que pasa mientras se edita el árbol durante
 * una generación. Sin esto, cerrar la hoja escondería que hay algo en vuelo, y
 * un Análisis podría llegar sin que nadie se entere.
 *
 * Se avisa AQUÍ y no con un toast de éxito a propósito: el criterio del ticket
 * es que generar no bloquee la edición, y un cartel que sube encima justo
 * cuando estabas escribiendo un Nodo la interrumpe igual que un diálogo. Es el
 * mismo criterio con el que la cabecera ya cuenta el Autoguardado.
 */
export type DoorState = "analizar" | "generando" | "listo";

export function doorState({
  generating,
  /** Llegó un Análisis y la hoja no se ha abierto desde entonces. */
  unread,
}: {
  generating: boolean;
  unread: boolean;
}): DoorState {
  // Generar manda sobre «listo»: si no, regenerar sin abrir la hoja dejaría el
  // botón anunciando un Análisis que se está sustituyendo en ese momento.
  if (generating) return "generando";
  return unread ? "listo" : "analizar";
}
