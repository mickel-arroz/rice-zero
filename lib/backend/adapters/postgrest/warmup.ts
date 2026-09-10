/**
 * El tropiezo de la sesión, visto desde una LECTURA.
 *
 * `neon/store.ts` ya lo atrapa para las escrituras (`isSessionHiccup`): Neon
 * establece la sesión JWT sobre una conexión de su pool, y de vez en cuando la
 * primera petición llega antes de que esa sesión esté puesta. Con `auth.uid()`
 * nulo, RLS no casa con nada.
 *
 * En una ESCRITURA eso es un 42501 —hay error, hay algo que atrapar—. En una
 * lectura no: el motor contesta **200 con cero filas**. Ése es el bug #41, y es
 * lo que se veía como «la lista de Proyectos sale vacía la primera vez y al
 * recargar ya está»:
 *
 *     GET /rest/v1/project_overviews?select=*&order=… → 200 []
 *
 * El comentario de aquel store decía que en una lectura «no hay nada que
 * detectar». Sí lo hay, y no son las filas: es **cuándo**. El tropiezo solo cabe
 * en la ventana en la que la sesión aún no está puesta, o sea, en las peticiones
 * que SALEN con un token que todavía no ha confirmado ninguna respuesta. Fuera
 * de ella, una lista vacía es una lista vacía.
 *
 * ── «Al salir» y no «al volver» ───────────────────────────────────────────
 *
 * La primera versión de esto cerraba la ventana en cuanto volvía cualquier
 * respuesta, y se quedó corta: abrir un Proyecto lanza TRES lecturas a la vez
 * —los Proyectos, las Versiones y el árbol— y todas salen dentro de la misma
 * ventana mala. La primera en volver marcaba el token como rodado y las otras
 * dos se quedaban sin reintento aunque hubieran salido antes que ella. El bug
 * seguía, solo que ahora en `project_versions` en vez de en `project_overviews`.
 *
 * Así que la frescura se mira ANTES de mandar la petición, no después. Y la
 * ventana se cierra con una respuesta que PRUEBE que la sesión está puesta —una
 * que trae filas— o cuando ya se ha gastado el reintento, que es lo que impide
 * que una cuenta de verdad vacía siga preguntando dos veces para siempre.
 *
 * De ahí la regla de abajo, que es todo lo que este módulo decide. Vive suelta y
 * con test por lo mismo que el resto de las decisiones de este repositorio: se
 * puede equivocar en dos direcciones —reintentar de más cuesta un viaje, no
 * reintentar deja la pantalla mintiendo— y ninguna de las dos se ve leyendo el
 * `store`.
 */

/**
 * Lo que se sabe de una lectura que acaba de volver.
 *
 * `tokenIsFresh` es la señal, y la única que hay: significa «con este JWT
 * todavía no ha vuelto ninguna petición del Data API», no «el JWT es nuevo».
 * Quien la mantiene es el cliente, que es el único que sabe cuándo lo trajo.
 */
export type EmptyRead = {
  /** Volvió sin nada: cero filas, cero en la cuenta, o ninguna fila de una RPC. */
  empty: boolean;
  /**
   * El token con el que SALIÓ esta petición no había confirmado todavía ninguna
   * respuesta. Se mira al mandarla y no al recibirla: ver la cabecera.
   */
  tokenIsFresh: boolean;
  /** Este intento ya ERA el reintento. Nunca hay un tercero. */
  retried: boolean;
};

/**
 * ¿Merece la pena volver a preguntar?
 *
 * Las tres condiciones son necesarias, y cada una acota un fallo distinto:
 *
 *   · **Volvió vacía.** Con filas no hubo tropiezo: RLS casó.
 *   · **Token recién estrenado.** Es la ventana del tropiezo. Sin esto, cada
 *     Versión vacía y cada Búsqueda sin resultados pagarían un viaje de más,
 *     para siempre.
 *   · **No se ha reintentado ya.** Uno y no un bucle: si el segundo intento
 *     también vuelve vacío, es que la lista está vacía de verdad. Es el mismo
 *     criterio que `retryOnce` aplica a las escrituras.
 *
 * El precio de equivocarse por exceso está acotado a UN viaje por token: una
 * cuenta recién creada, que de verdad no tiene Proyectos, pregunta dos veces la
 * primera vez y una a partir de entonces.
 */
export function shouldRetryEmptyRead({
  empty,
  tokenIsFresh,
  retried,
}: EmptyRead): boolean {
  return empty && tokenIsFresh && !retried;
}
