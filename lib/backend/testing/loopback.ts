/**
 * El cable entero, en memoria y sin servidor.
 *
 * Cose las tres piezas que el ADR 0006 puso entre la app y el motor —el
 * adaptador HTTP, los doce Route Handlers y el envoltorio compartido— sobre el
 * adaptador en memoria, con un `fetch` que enruta a los handlers de VERDAD en
 * vez de salir a la red.
 *
 * Es lo que permite correr `describeBackendContract` contra el cable y no solo
 * contra el núcleo. Lo que eso cubre, y que ninguna otra corrida cubría:
 *
 *   · que los 23 métodos del puerto llegan al handler que les toca (un nombre
 *     mal escrito revienta el test, no producción);
 *   · que cada entidad vuelve con sus `Date` siendo `Date` — la suite compara
 *     entidades, y una fecha convertida en cadena no pasa;
 *   · que `NotFoundError` y `ConflictError` cruzan como INSTANCIAS de su clase
 *     y con sus campos, porque la suite hace `rejects.toThrow(NotFoundError)`.
 *
 * El ADR 0002 anotó como deuda que la corrida en vivo no atraviesa `/api/auth`
 * y que «eso hay que verlo en `next dev`». Esto es esa deuda pagada para los
 * datos, que es donde de verdad dolía.
 */

import { createHttpRepositories } from "@/lib/backend/adapters/http";
import { setServerBackend } from "@/lib/backend/server";
import type { BackendProvider, ServerBackendProvider } from "@/lib/backend/ports";
import { createInMemoryBackend, type InMemoryBackend } from "@/lib/backend/testing/in-memory";
import { routeLoopback } from "@/lib/backend/testing/loopback-router";

/** Un origen cualquiera: lo único que importa es que la petición tenga URL. */
const ORIGIN = "https://rice.invalid";

export type LoopbackBackend = BackendProvider & {
  /** El de dentro, para montar escenarios que el puerto no sabe montar. */
  readonly inMemory: InMemoryBackend;
};

/**
 * Un Proveedor de Backend cuyos datos van y vuelven por el cable de verdad.
 *
 * La mitad de auth es la del adaptador en memoria, sin salto: lo que se está
 * probando es el camino de DATOS, y hacer pasar también el login por aquí
 * añadiría un proxy de auth de mentira que no se parecería al de producción.
 */
export function createLoopbackBackend(): LoopbackBackend {
  const inMemory = createInMemoryBackend();

  const server: ServerBackendProvider = {
    name: "loopback",
    session: {
      needsGateOnPublicPath: () => false,
      // La sesión sale del adaptador en memoria y no de una cookie: aquí no hay
      // navegador que la mande. Lo que el handler comprueba —que hay sesión y
      // que puede actuar— es lo mismo.
      sessionFor: () => inMemory.auth.currentSession(),
      gate: async () => ({ kind: "allow", setCookies: [], requestHeaders: {} }),
    },
    authRoute: null,
    data: { repositoriesFor: async () => inMemory },
  };

  setServerBackend(server);

  const loopbackFetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), ORIGIN);
    return routeLoopback(new Request(url, init as RequestInit));
  };

  return {
    name: "loopback",
    auth: inMemory.auth,
    inMemory,
    ...createHttpRepositories({ fetch: loopbackFetch }),
  };
}
