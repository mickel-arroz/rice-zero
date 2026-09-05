/**
 * Qué hacer con el borrador que espera a escribirse cuando cambia la conexión.
 *
 * Existe por lo mismo que `components/tree/autosave.ts`: la única parte de la
 * retención que tiene una DECISIÓN dentro se saca a funciones puras, para
 * poder comprobarla sin montar un componente ni desenchufar el wifi. El
 * `setTimeout`, la `ref` y el estado del pie son cableado de React y viven en
 * `TreeProvider` y `VersionsProvider`.
 *
 * Y vive en `components/connection` y no junto a cada Autoguardado porque los
 * DOS lo consultan con la misma tabla — el texto de un Nodo y la etiqueta de
 * una Versión rebotan igual y se retienen igual. Que el cableado siga
 * duplicado en los dos providers es sabido y tiene su propio ticket (#24); lo
 * que no puede estar duplicado es la regla, porque entonces un día una de las
 * dos copias suelta el borrador y la otra no.
 *
 * Módulo puro, sin imports.
 */

/**
 * El hueco del Autoguardado: qué Nodo o Versión espera, y su temporizador.
 *
 * Genérico en `T` porque el tipo que devuelve `setTimeout` no es el mismo en
 * Node que en el navegador, y este módulo no tiene por qué elegir uno: lo
 * único que mira es si hay temporizador o no.
 */
export type PendingSlot<T> = {
  id: string;
  /**
   * `null` significa RETENIDO: el rebote se paró porque no hay red.
   *
   * Es un `null` con significado, así que nadie debería leerlo a mano — para
   * eso está `pendingState`, que le pone nombre.
   */
  timer: T | null;
};

/**
 * En cuál de los tres estados está el hueco.
 *
 * `armed` es el rebote normal en marcha; `held` es lo retenido esperando red.
 * Son estados distintos y no un booleano «hay algo» porque la tabla de
 * `movePending` los trata al revés en las dos fases.
 */
export type PendingState = "none" | "armed" | "held";

export function pendingState<T>(slot: PendingSlot<T> | null): PendingState {
  if (slot === null) return "none";
  return slot.timer === null ? "held" : "armed";
}

/**
 * Lo que hay que hacerle al hueco.
 *
 * `hold`: parar el temporizador y quedarse el borrador. `release`: escribirlo
 * YA. `keep`: no tocar nada.
 */
export type PendingMove = "hold" | "release" | "keep";

/**
 * La tabla entera del bloqueo offline, en cinco filas.
 *
 * Las dos que importan son obvias —al perder la red se retiene, al volver se
 * suelta— y las dos que no lo son son las que hacen que esto funcione:
 *
 *   · `armed` con red se queda: el rebote en marcha NO se adelanta porque el
 *     banner haya cambiado de fase. Con un `release` aquí, pasar de «de
 *     vuelta» a normal escribiría a mitad de palabra.
 *   · `held` sin red se queda: lo ya retenido no se vuelve a retener. Sin esta
 *     rama, cada repintado con la red caída reescribiría el hueco y volvería a
 *     marcar «Pendiente» sobre un estado que ya lo decía.
 *
 * @param blocked lo que contesta `useBlocked()` en este repintado.
 */
export function movePending(state: PendingState, blocked: boolean): PendingMove {
  if (state === "none") return "keep";
  if (blocked) return state === "armed" ? "hold" : "keep";
  return state === "held" ? "release" : "keep";
}
