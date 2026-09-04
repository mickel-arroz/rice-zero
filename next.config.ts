import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Detección de conexión y reintento automático de lo que se quedó a medias.
     *
     * Con esto puesto, una navegación, un fetch RSC o un Server Action que se
     * queda sin red NO lanza: Next lo deja pendiente y lo repite cuando la
     * conexión vuelve. Es literalmente el «reintento automático de reconexión»
     * que pide Autoguardado en `CONTEXT.md`, y es lo que hace que la app no
     * necesite ni un `catch` de reconexión ni un bucle de reintento propio.
     *
     * También es lo que hace que `useOffline` devuelva algo distinto de `false`:
     * sin el flag el hook existe pero miente. Y su lectura es mejor que
     * `navigator.onLine`, que dice «conectado» en un wifi sin salida.
     *
     * Cubre las navegaciones suaves. Recargar sin red sigue necesitando al
     * service worker, que es la otra mitad de este ticket.
     */
    useOffline: true,
  },
};

/**
 * `withSerwist` solo añade lo que la ruta del worker necesita para encontrarse
 * (`basePath`, `distDir`, `assetPrefix`). NO es un plugin de bundler: el worker
 * lo compila `app/serwist/[path]/route.ts` con esbuild, fuera del build. Es por
 * eso que este ticket no puede tumbar el build de Turbopack, que es lo que sí
 * hace la configuración de webpack de `@serwist/next` en Next 16.
 */
export default withSerwist(nextConfig);
