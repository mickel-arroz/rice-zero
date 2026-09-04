/**
 * Las decisiones de la caché del service worker, en funciones puras.
 *
 * El worker de `app/sw.ts` no se puede testear: corre en un
 * `ServiceWorkerGlobalScope` y lo compila esbuild en tiempo de build. Así que lo
 * que decide vive aquí —módulo normal, sin dependencias de Serwist ni del DOM—
 * y allí solo queda el cableado. Es la misma línea que `lib/auth/routes.ts` traza
 * con `proxy.ts`: la decisión que puede dejar datos de alguien al aire se prueba
 * suelta, no a través del sitio donde se aplica.
 */

/**
 * Lo mínimo que hace falta saber de una petición para decidir sobre ella.
 *
 * Es estructural y no el tipo de Serwist a propósito: un test no puede
 * construir un `Request` ni un `ExtendableEvent` de verdad, y atarse al tipo
 * del paquete obligaría a simular las dos cosas para comprobar tres
 * comparaciones. Quien adapta lo uno a lo otro es `app/sw.ts`.
 *
 * El origen llega como dato y no se lee de `self.location`: así la decisión no
 * depende de correr dentro de un worker.
 */
export interface CacheQuestion {
  readonly request: {
    readonly destination: string;
    readonly method: string;
    readonly url: string;
  };
  /** El origen de la app, contra el que se mide si la petición es de fuera. */
  readonly origin: string;
}

/**
 * ¿A esta petición le toca la pantalla offline?
 *
 * Es el `matcher` del `fallback` del worker: cuando la red falla y no hay nada
 * en caché, esto decide si se responde con `/offline`.
 */
export function isOfflineDocument({ request, origin }: CacheQuestion): boolean {
  // `document` deja fuera de un plumazo todo lo que no es una página: las
  // peticiones RSC y los prefetch llegan como `fetch` (destino vacío), y las
  // imágenes, los scripts y las fuentes traen el suyo. Cada una tiene su regla
  // en `defaultCache`; la pantalla offline es solo para lo que el usuario ve.
  if (request.destination !== "document") return false;
  // Escribir sin red no es una consulta degradada: es un envío que no ocurrió.
  // Responder 200 con la pantalla offline a un POST se lee como que salió bien.
  if (request.method !== "GET") return false;
  // El worker ve también lo que sale del origen. Servir NUESTRA pantalla
  // offline en el sitio de una página ajena sería suplantarla.
  return new URL(request.url).origin === origin;
}

/**
 * Lo mínimo que hace falta de `CacheStorage` para vaciarlo. Estructural por lo
 * mismo que `CacheQuestion`: un test no tiene un `CacheStorage` de verdad.
 */
export interface CacheKeyStore {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

/**
 * Las cachés que PUEDEN sobrevivir a un cierre de sesión.
 *
 * Es una lista blanca por lo mismo que `PUBLIC_ROUTES`: una caché nueva nace
 * privada. Al revés —nombrando las privadas— añadir una regla a `runtimeCaching`
 * y olvidar apuntarla aquí dejaría páginas de alguien sobreviviendo al logout,
 * y nada avisaría. Equivocarse por este lado cuesta una caché fría; por el otro,
 * los Proyectos de alguien.
 *
 * Los nombres son los que pone `defaultCache` de `@serwist/turbopack/worker`.
 * Dentro están solo los que guardan el CASCARÓN de la app: fuentes, imágenes,
 * JS y CSS. Es lo que hace que después de cerrar sesión la app siga instalada y
 * arrancando al instante, que es para lo que se cachea.
 *
 * Los que se quedan fuera, y por qué:
 *
 * - `pages`, `pages-rsc`, `pages-rsc-prefetch`: el HTML y los payloads RSC de
 *   las páginas autenticadas. Son literalmente los Proyectos del usuario.
 * - `apis`: copias `NetworkFirst` de los GET a `/api/*`.
 * - `others`: cae aquí TODO GET del origen que ninguna regla anterior atrapó,
 *   así que no se puede saber qué lleva dentro. Cuando no se sabe, se tira.
 * - `static-data-assets`: cualquier `.json`. Un día será uno con datos.
 * - `next-data`: son los props de página del Pages Router. La app es App Router
 *   y esta caché no debería existir nunca; si aparece, algo trae datos dentro.
 * - `cross-origin`: no es nuestro, y encima es donde acaba el avatar del
 *   usuario — `components/ui/avatar.tsx` lo pinta con un `<img>` crudo desde la
 *   URL del proveedor, que no lleva extensión y por tanto no cae en
 *   `static-image-assets`. Es la cara del que se acaba de ir.
 */
const SURVIVES_SIGN_OUT: readonly string[] = [
  "static-font-assets",
  "static-image-assets",
  "static-js-assets",
  "static-style-assets",
  "next-static-js-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  // Las fuentes de la app se sirven en local («cero CDNs», ver `/about`), así
  // que estas dos no llegan a existir hoy. Van igual: las reglas que las crean
  // están en `defaultCache`, y el día que alguien añada una hoja de Google
  // Fonts la caché aparecería y no debe morir en cada logout.
  "google-fonts-webfonts",
  "google-fonts-stylesheets",
];

/**
 * El precache de Serwist lleva un id variable en el nombre, así que se compara
 * por prefijo. Dentro solo hay lo que el build precacheó: nada de nadie.
 */
const PRECACHE_PREFIX = "serwist";

function survivesSignOut(name: string): boolean {
  return SURVIVES_SIGN_OUT.includes(name) || name.startsWith(PRECACHE_PREFIX);
}

/**
 * Borra del navegador toda caché que pueda llevar datos del usuario que se va.
 *
 * Lo llama el worker cuando el cliente le avisa de que se cerró sesión. Vive en
 * el worker y no en el componente porque las cachés son suyas: quien las crea
 * es quien sabe vaciarlas.
 */
export async function clearPrivateCaches(store: CacheKeyStore): Promise<void> {
  const names = await store.keys();
  await Promise.all(
    names.filter((name) => !survivesSignOut(name)).map((name) => store.delete(name)),
  );
}

/**
 * El aviso que el cliente le manda al worker al cerrar sesión.
 *
 * Vive aquí, con la función que lo atiende, y no en `lib/constants.ts`: es un
 * protocolo entre dos mitades de la app —`components/auth/use-sign-out.ts` y
 * `app/sw.ts`—, no texto ni ruta. Si las dos no leen el mismo nombre el mensaje
 * se pierde en silencio, que es el peor final posible para un borrado.
 */
export const SIGN_OUT_MESSAGE = "rice-zero:sign-out";
