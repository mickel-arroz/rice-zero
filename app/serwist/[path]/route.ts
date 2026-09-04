import { createSerwistRoute } from "@serwist/turbopack";

import { ROUTES } from "@/lib/constants";

/**
 * La versión de lo que se precachea a mano.
 *
 * Tiene que cambiar en cada build. Con `revision: null` Serwist da la URL por
 * ya versionada y no vuelve a pedirla nunca: la pantalla offline se quedaría
 * congelada en la primera copia que se instaló, para siempre, aunque el texto
 * cambiara en un deploy posterior.
 *
 * El SHA del commit cuando el proveedor lo da; si no, un id nuevo. El id nuevo
 * NO es un parche perezoso: peca por el lado bueno —una página pequeña se
 * vuelve a bajar en cada deploy— mientras que el otro lado es servir texto
 * viejo sin forma de arreglarlo. No se lanza `git` como en el ejemplo de
 * Serwist porque un build no siempre corre dentro de un repo.
 *
 * Se evalúa una vez por build: la ruta es `force-static`.
 */
const REVISION_ENV_KEYS = ["VERCEL_GIT_COMMIT_SHA", "BUILD_REVISION"] as const;

const REVISION =
  REVISION_ENV_KEYS.map((key) => process.env[key]).find(Boolean) ??
  crypto.randomUUID();

/**
 * Compila y sirve el service worker.
 *
 * Es una ruta y no un plugin del bundler a propósito, y es lo que hace que este
 * ticket no pueda romper el build: en Next 16 la configuración de webpack de
 * `@serwist/next` lo tumba, porque el build es de Turbopack. Este es el camino
 * oficial de Serwist para Turbopack — el worker lo compila esbuild desde aquí,
 * fuera del grafo de módulos de la app.
 *
 * `dynamic: "force-static"` lo trae `createSerwistRoute`: el worker se genera en
 * el build, no por petición.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    /**
     * La pantalla offline entra al precache a mano: no la alcanza ningún
     * `<Link>`, así que `cacheOnNavigation` nunca la guardaría, y es justo la
     * que tiene que estar ahí antes de que falle la red.
     */
    additionalPrecacheEntries: [{ url: ROUTES.offline, revision: REVISION }],
    /**
     * `esbuild` nativo y no `esbuild-wasm`. El valor por defecto depende del
     * sistema —wasm fuera de Windows, nativo dentro—, así que sin fijarlo el
     * build pediría en CI un paquete que no está instalado.
     */
    useNativeEsbuild: true,
  });
