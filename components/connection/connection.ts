/**
 * En qué estado está la conexión, de cara a la interfaz.
 *
 * Existe por lo mismo que `components/tree/autosave.ts`: la única parte del
 * bloqueo offline que tiene una DECISIÓN dentro se saca a funciones puras,
 * para poder comprobarla sin montar un componente ni desenchufar el wifi. Todo
 * lo demás —escuchar al navegador, el temporizador, apagar los botones— es
 * cableado de React y vive en `connection-provider.tsx`.
 *
 * ── Por qué TRES fases y no el booleano que da el navegador ───────────────
 *
 * `useOffline()` de Next contesta sí o no, y con eso solo se pueden pintar dos
 * pantallas: bloqueada y normal. Falta la tercera, que es la que el ticket pide
 * de verdad: «al volver la conexión, la edición se reactiva sola». Si la vuelta
 * fuera únicamente la desaparición del banner, quien estuviera mirando otra
 * parte de la pantalla no se enteraría de que ya puede escribir, y volvería a
 * pulsar el botón que hace un momento no respondía para ver si ahora sí.
 *
 * `back` es esa tercera: dura unos segundos, lo dice, y se va sola. Es estado
 * de la INTERFAZ y no de la red —la red ya está—, y por eso `blocksMutations`
 * la deja pasar: hacer esperar a que se apague un cartel sería un bloqueo
 * inventado por nosotros.
 *
 * Módulo puro, sin imports: lo consume el provider (que lo mueve) y el banner
 * (que lo pinta).
 */

/**
 * Cuánto se queda el «de vuelta» antes de apagarse.
 *
 * Dos segundos: lo que se tarda en leer tres palabras. Más y estorba a la
 * edición que acaba de desbloquear; menos y quien no estuviera mirando la
 * franja de arriba en ese instante no llega a verlo.
 */
export const BACK_MS = 2000;

/**
 * Las tres fases.
 *
 * `back` NO significa «se acaba de recuperar la red» a secas: significa «se
 * recuperó y todavía lo estamos contando». Quien pregunta si puede escribir
 * usa `blocksMutations`, nunca la fase a pelo.
 */
export type ConnectionPhase = "online" | "offline" | "back";

/**
 * La fase que toca, según lo que dice el detector del navegador.
 *
 * @param current la fase de ahora.
 * @param offline lo que contesta `useOffline()` en este repintado.
 *
 * Las dos ramas que parecen de más son las que hacen que esto funcione:
 *
 *   · `online` + con red se queda en `online`, y no salta a `back`. Es el
 *     arranque de toda sesión normal; sin esta rama, cada carga de página
 *     anunciaría la vuelta de algo que nunca se fue.
 *   · `back` + con red se queda en `back`, y no se «renueva». Quien apaga ese
 *     aviso es el temporizador (`settlePhase`), no el detector: si esta rama
 *     volviera a devolver `back` cada vez que el hook repinta, el cartel se
 *     quedaría fijo para siempre.
 */
export function nextPhase(
  current: ConnectionPhase,
  offline: boolean,
): ConnectionPhase {
  if (offline) return "offline";
  return current === "offline" ? "back" : current;
}

/**
 * Lo que hace el temporizador al cumplirse: apagar el «de vuelta».
 *
 * Solo toca esa fase. Un temporizador capaz de sacar de `offline` reactivaría
 * la edición sin que hubiera vuelto la red, que es exactamente el fallo que
 * este ticket existe para no tener.
 */
export function settlePhase(current: ConnectionPhase): ConnectionPhase {
  return current === "back" ? "online" : current;
}

/**
 * ¿Está prohibido escribir ahora mismo?
 *
 * Lo pregunta cada botón que muta, y es UNA función y no un `phase ===
 * "offline"` repartido por doce componentes por el mismo motivo por el que
 * `retryable` vive en la clase del error y no en un `switch` de la pantalla:
 * el día que nazca una cuarta fase, aquí hay un sitio donde decidir y no doce
 * donde olvidarse.
 */
export function blocksMutations(phase: ConnectionPhase): boolean {
  return phase === "offline";
}
