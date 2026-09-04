import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Configuración de la generación EN VIVO contra Gemini.
 *
 * Es un tercer archivo y no un `include` más en `vitest.live.config.ts` por una
 * razón concreta: ese carga `vitest.live.setup.ts`, que sustituye el `fetch`
 * global para FINGIR UN NAVEGADOR —le mete `Origin`, `Referer` y un tarro de
 * cookies a toda petición que salga—. Eso existe porque el Proveedor de Backend
 * está pensado para el navegador y su SDK da por supuestas las tres cosas.
 *
 * El adaptador de Gemini es lo contrario: corre en el servidor, es
 * `server-only`, y no hay navegador que simular. Mandarle un `Origin` a
 * `generativelanguage.googleapis.com` no solo es mentira — una API key de Google
 * con restricciones de referente contestaría un 403 que no dice nada del
 * adaptador, y esa tarde se iría en buscar el fallo donde no está.
 *
 * Sí se carga `vitest.setup.ts`, que es el que lee `.env.local`: de ahí sale la
 * API key. Que ese archivo fuerce `AI_PROVIDER=falso` da igual aquí, porque la
 * corrida en vivo construye el adaptador de Gemini directamente en vez de
 * pedirlo a la fábrica. Ver el encabezado de `gemini.live.test.ts`.
 *
 * La lanza `scripts/ai-live.mjs` (`npm run ai:live`), nunca `npm test`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/ai/**/*.live.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],

    // Un Análisis de un árbol grande son decenas de segundos, y aquí van tres
    // llamadas seguidas dentro de un solo `beforeAll`. Los 5 s por defecto no
    // llegan ni al primero.
    testTimeout: 240_000,
    hookTimeout: 300_000,

    // El free tier limita las peticiones por minuto: en paralelo se ganan un
    // 429 que parecería un fallo del adaptador.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Lo que Next resuelve solo y Vitest no. Ver `vitest.server-only.ts`.
      "server-only": fileURLToPath(
        new URL("./vitest.server-only.ts", import.meta.url),
      ),
    },
  },
});
