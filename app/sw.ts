/**
 * El service worker: lo que hace que lo ya navegado se pueda consultar sin red.
 *
 * NO forma parte del bundle de la app. Lo compila esbuild desde
 * `app/serwist/[path]/route.ts`, así que corre en un `ServiceWorkerGlobalScope`
 * y no puede importar nada que toque el DOM ni React. Por eso las decisiones
 * viven en `lib/pwa/cache.ts` —módulo puro y con tests— y aquí solo queda el
 * cableado con Serwist.
 */

import { defaultCache } from "@serwist/turbopack/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

import { ROUTES } from "@/lib/constants";
import {
  SIGN_OUT_MESSAGE,
  clearPrivateCaches,
  isOfflineDocument,
} from "@/lib/pwa/cache";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    /** Donde el build inyecta la lista de lo precacheado. */
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Un worker viejo sirviendo el JS de un deploy anterior es la forma más rara
  // de romper una PWA, así que el nuevo toma el relevo en cuanto está listo.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  /**
   * La política de Serwist para Next tal cual: `/api/auth/*` nunca se cachea, y
   * el HTML y los payloads RSC van `NetworkFirst`. Ese `NetworkFirst` es
   * exactamente «lo navegado con conexión es consultable sin conexión»: con red
   * gana el servidor, sin red responde la copia.
   *
   * Y es la mitad que obliga a `clearPrivateCaches`: esas copias son del
   * origen, no de la sesión.
   */
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: ROUTES.offline,
        // El `matcher` de un fallback recibe solo `{ request, event, error }`
        // —no el `url` ni el `sameOrigin` que sí llegan a un matcher de ruta—,
        // así que el origen se lo da el worker.
        matcher: ({ request }) =>
          isOfflineDocument({ request, origin: self.location.origin }),
      },
    ],
  },
});

/**
 * Cerrar sesión vacía las cachés con páginas del usuario dentro.
 *
 * El worker es quien las borra porque son suyas. El cliente solo avisa: no
 * puede saber qué cachés existen ni cuáles llevan datos.
 */
self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  if ((data as { type?: unknown } | null)?.type !== SIGN_OUT_MESSAGE) return;
  // `waitUntil` para que el navegador no mate al worker a mitad del borrado:
  // media purga deja justo las páginas que se querían quitar.
  event.waitUntil(clearPrivateCaches(caches));
});

serwist.addEventListeners();
