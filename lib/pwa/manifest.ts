/**
 * El manifest de la PWA, como dato puro.
 *
 * `app/manifest.ts` es un Route Handler de Next y no se puede importar desde un
 * test sin arrastrar el runtime del framework. Así que lo que el manifest DICE
 * vive aquí y allí solo queda `export default appManifest`. Lo que se prueba son
 * los criterios de instalabilidad, que es lo único del manifest que se puede
 * romper sin que nada avise: un icono que falta no da error, simplemente hace
 * que el navegador deje de ofrecer «instalar».
 */

import type { MetadataRoute } from "next";

import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants";

/** Un icono, con exactamente los campos que el manifest declara de él. */
interface AppIcon {
  readonly src: string;
  /** `"192x192"`. Es también de donde el test saca el lado que debe medir. */
  readonly sizes: string;
  readonly type: "image/png";
  readonly purpose?: "maskable";
}

/**
 * Los iconos de la app, en un solo sitio.
 *
 * Los rasteriza `scripts/generate-icons.mjs` con sharp desde la marca en matriz
 * de puntos, y de ahí salen los PNG de `public/icons/`. Cuánto del lienzo ocupa
 * el glifo en cada uno vive ALLÍ y no aquí: es una decisión de dibujo, y el
 * manifest no tiene nada que declarar sobre ella. Lo que sí vigila
 * `manifest.test.ts` es que detrás de cada `src` haya un archivo de ese tamaño.
 */
export const APP_ICONS: readonly AppIcon[] = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  /**
   * Android recorta el icono a la forma que le toque —círculo, cuadrado
   * redondeado, gota— y solo garantiza el 80 % central, así que este lleva el
   * glifo más apartado del borde. Sin un `maskable` el sistema no sabe qué
   * parte puede sacrificar y se come el glifo.
   */
  {
    src: "/icons/icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
] as const;

/**
 * El icono que iOS usa en la pantalla de inicio.
 *
 * Fuera del manifest a propósito: iOS no lo lee. Lo declara
 * `metadata.icons.apple` en `app/layout.tsx`.
 */
export const APPLE_TOUCH_ICON: AppIcon = {
  src: "/icons/apple-touch-icon.png",
  sizes: "180x180",
  type: "image/png",
} as const;

/**
 * `--background` de los dos temas, en hexadecimal.
 *
 * Este es el ÚNICO sitio donde el fondo de la app está escrito una segunda vez.
 * Hace falta porque ni el manifest ni una etiqueta `<meta>` entienden `oklch()`
 * ni variables CSS, así que el valor de `app/globals.css` no se puede reutilizar
 * tal cual. Lo consumen los dos que lo necesitan: `appManifest` de aquí abajo y
 * `viewport.themeColor` en `app/layout.tsx`.
 *
 * Si alguien toca `--background` en `globals.css`, esto hay que tocarlo a mano.
 * No hay forma de evitarlo sin meter un paso de build, y un paso de build para
 * dos colores sale más caro que el riesgo.
 */
export const THEME_COLORS = {
  light: "#fafafa",
  dark: "#0a0a0a",
} as const;

export function appManifest(): MetadataRoute.Manifest {
  return {
    id: ROUTES.home,
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: "es",
    dir: "ltr" as const,
    /**
     * Una app instalada abre en el dashboard, no en la landing: quien la
     * instaló ya pasó por ahí. Sin sesión, `proxy.ts` la manda al login, que es
     * exactamente lo que tiene que pasar.
     */
    start_url: ROUTES.projects,
    scope: ROUTES.home,
    display: "standalone" as const,
    /**
     * El manifest solo admite UN color, y el tema por defecto es el claro. La
     * barra de estado sí distingue los dos, y eso lo resuelve
     * `viewport.themeColor`, que acepta media queries.
     */
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["productivity", "developer"],
    // Sin `orientation` a propósito: la Vista Canvas es de escritorio y
    // apaisada, así que fijar «portrait» por ser mobile-first la rompería en
    // tablet.
    // Copia y no la constante: el tipo `Manifest` de Next pide un array
    // mutable, y `APP_ICONS` es `readonly` para que nadie le añada nada a mano
    // sin pasar por el generador.
    icons: [...APP_ICONS],
  };
}
