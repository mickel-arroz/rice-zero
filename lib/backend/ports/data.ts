/**
 * La mitad de DATOS del Proveedor de Backend en servidor.
 *
 * `session.ts` trajo la primera mitad de servidor —leer la sesión de una
 * petición y decidir si pasa— cuando el ADR 0002 metió `/api/auth`. Ésta es la
 * segunda: leer y escribir los datos de esa petición, ahora que el navegador ya
 * no habla con el motor.
 *
 * Que el puerto crezca aquí y no aparezca un módulo suelto es lo que mantiene
 * cierta la promesa del ADR 0001: sigue habiendo UN interruptor, y
 * `NEXT_PUBLIC_BACKEND` mueve las tres mitades a la vez. Un adaptador que no
 * implemente esto no compila, que es exactamente la forma de que el proveedor
 * dormido no se quede atrás.
 *
 * Ver `docs/adr/0006-los-datos-pasan-por-la-api-propia.md`.
 */

import type { BackendProvider } from "@/lib/backend/ports/provider";

/**
 * Los cuatro repositorios, sin la mitad de auth.
 *
 * Se deriva de `BackendProvider` con `Pick` en vez de declararse aparte para que
 * no puedan divergir: el día que el puerto gane un repositorio, éste lo gana
 * solo y el adaptador que no lo implemente deja de compilar.
 */
export type Repositories = Pick<
  BackendProvider,
  "projects" | "versions" | "nodes" | "analyses"
>;

export interface ServerData {
  /**
   * Los repositorios que actúan EN NOMBRE de esta petición.
   *
   * Nunca se memoiza el resultado entre peticiones y no es una optimización que
   * falte: la identidad del usuario va DENTRO de estos repositorios, así que
   * compartir uno entre dos peticiones es servirle a alguien los datos de otro.
   * Lo que sí se puede cachear —y se cachea— es el token, con la cookie que lo
   * autoriza como clave.
   *
   * Toma un `Request` y no unas `Headers`, a diferencia de `sessionFor`. La
   * razón es concreta: el adaptador de Neon necesita el ORIGEN de la petición
   * para pedirle el JWT al proveedor, que rechaza con `403 Missing or null
   * Origin` una petición sin él. Con solo cabeceras habría que reconstruir la
   * URL a mano desde `host`, que es adivinar lo que ya venía dado. Y no es una
   * excepción en el puerto: `gate` y `AuthRoute.handle` ya hablan `Request`.
   *
   * @throws UnauthenticatedError si la petición no trae una sesión utilizable.
   *   Lanza en vez de devolver `null` porque quien llama no tiene nada mejor que
   *   hacer con ese caso, y porque es el mismo error que lanzaría el repositorio
   *   a la primera consulta: adelantarlo ahorra un viaje al motor.
   */
  repositoriesFor(request: Request): Promise<Repositories>;
}
