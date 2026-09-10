/**
 * El tropiezo de la sesión, visto desde una LECTURA.
 *
 * Neon establece la sesión JWT sobre una conexión de su pool, y de vez en
 * cuando la primera petición llega antes de que esté puesta. Con `auth.uid()`
 * nulo, RLS no casa con nada.
 *
 * En una ESCRITURA eso es un 42501 —hay error, hay algo que atrapar—. En una
 * lectura no: el motor contesta **200 con cero filas**. Ése es el bug #41, y es
 * lo que se veía como «la lista de Proyectos sale vacía la primera vez y al
 * recargar ya está»:
 *
 *     GET /rest/v1/project_overviews?select=*&order=… → 200 []
 *
 * ── Por qué la regla no intenta adivinar la ventana ───────────────────────
 *
 * Los dos intentos anteriores sí lo intentaron, y los dos fallaron. La idea era
 * que el tropiezo solo cabe mientras la sesión no está puesta, así que bastaba
 * con reintentar las lecturas que salieran «con el token recién estrenado» y
 * dejar en paz a las demás. Una lista vacía de verdad no pagaría nada.
 *
 * El problema es que esa señal no existe en el momento en que hay que leerla.
 * El JWT se pide PEREZOSAMENTE, dentro de la propia petición: el SDK llama a
 * `getToken` mientras la manda. Así que en la primerísima lectura de la sesión
 * —justo la que tropieza— todavía no hay token cacheado, la señal contesta «no
 * está fresco» porque no hay nada, y el reintento no se dispara. Cada arreglo
 * pasaba sus tests porque el doble arrancaba con un token ya puesto, que es el
 * único estado que el cliente de verdad no tiene al empezar.
 *
 * De ahí esta regla, que es deliberadamente tonta: **si la primera lectura
 * falla o vuelve vacía, se pregunta una segunda vez, y lo que conteste esa
 * segunda es la respuesta**. No hay ventana que calcular, ni estado que
 * mantener entre peticiones, ni un doble que pueda mentir sobre él.
 *
 * ── Lo que cuesta ─────────────────────────────────────────────────────────
 *
 * Un viaje de más por cada lectura que de verdad vuelve vacía: la Versión sin
 * Nodos, la Búsqueda sin resultados, la cuenta recién creada. Es un coste real
 * y es el precio elegido a sabiendas: enseñar «no tienes ningún Proyecto» a
 * quien tiene tres es un fallo que se ve, y una lista vacía que tarda el doble
 * en confirmarse no lo es.
 *
 * La cota es la que importa: **uno y solo uno**. Nunca hay un tercer intento,
 * así que ninguna pantalla puede quedarse dando vueltas.
 */

import { UnauthenticatedError } from "@/lib/backend/ports";

/** Lo que se sabe del primer intento cuando hay que decidir si va otro. */
export type FirstAttempt = {
  /** Lanzó. Un error de transporte, del motor o de RLS: da igual cuál. */
  failed: boolean;
  /** Volvió sin nada: cero filas, cero en la cuenta, o una RPC sin fila. */
  empty: boolean;
};

/**
 * ¿Se vuelve a preguntar?
 *
 * Las dos condiciones son la misma cosa vista desde los dos lados del mismo
 * tropiezo: una escritura sin sesión da error y una lectura sin sesión da
 * vacío. Cualquiera de las dos merece un segundo intento; el resto —una lectura
 * que trajo filas— ya está contestado.
 *
 * No recibe `retried`: quien llama solo pregunta por el PRIMER intento, y que
 * no haya tercero es una propiedad de `retryColdRead`, no una condición que
 * alguien pueda olvidarse de pasar. La versión anterior sí lo recibía, y el
 * `retried: false` escrito a mano en el único call site no probaba nada.
 */
export function shouldRetryRead({ failed, empty }: FirstAttempt): boolean {
  return failed || empty;
}

/**
 * Una lectura que, si vuelve mal o vuelve vacía, se hace una segunda vez.
 *
 * Es la función auxiliar por la que pasa TODA lectura de los dos adaptadores
 * PostgREST. Vive en el núcleo compartido y no en `neon/` porque el tropiezo es
 * de la forma «PostgREST + RLS + un pool por delante», no del proveedor.
 *
 * Lo que garantiza, en el orden en que importa:
 *
 *   1. Si el primer intento trae datos, se devuelve tal cual: un solo viaje.
 *   2. Si falla o vuelve vacío, se repite UNA vez.
 *   3. Lo que conteste el segundo intento es la respuesta final, venga vacío o
 *      venga con un error. Se propaga sin más reintentos.
 *   4. La promesa no se resuelve hasta tener esa respuesta final. De ahí sale
 *      solo el estado de carga de las pantallas: mientras esto no termine,
 *      quien llama sigue en «cargando», así que no hay parpadeo posible entre
 *      «vacío» y «aquí están tus Proyectos». No hace falta que ninguna pantalla
 *      colabore, y por eso no se le pide a ninguna.
 *
 * @param read la consulta, COMO FUNCIÓN. Un `PostgrestBuilder` se consume al
 *   esperarlo, así que el segundo intento necesita una nueva.
 * @param isEmpty qué significa «vacío» para lo que devuelve `read`. Lo decide
 *   quien llama porque no es lo mismo en una lista, en una cuenta y en una RPC.
 */
export async function retryColdRead<T>(
  read: () => Promise<T>,
  isEmpty: (result: T) => boolean,
): Promise<T> {
  let empty: boolean;

  try {
    const first = await read();
    empty = isEmpty(first);
    if (!shouldRetryRead({ failed: false, empty })) return first;
  } catch (error) {
    // La única excepción, y no es una lectura que salió mal: es una que no
    // llegó a salir. Sin sesión el SDK lanza ANTES de tocar la red, así que un
    // segundo intento manda exactamente la misma nada y retrasa el viaje al
    // login que es la respuesta correcta.
    if (error instanceof UnauthenticatedError) throw error;
    if (!shouldRetryRead({ failed: true, empty: false })) throw error;
  }

  // El segundo es el definitivo: lo que traiga es lo que se enseña, y si lanza,
  // lanza. Sin `try` a propósito — atraparlo aquí solo podría servir para
  // intentar un tercero.
  return read();
}
