import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Configuración de las corridas EN VIVO (`*.live.test.ts`).
 *
 * Es un archivo aparte y no un `mergeConfig` sobre `vitest.config.ts` porque las
 * dos configuraciones se contradicen a propósito: la de siempre EXCLUYE estos
 * archivos (`npm test` no debe pedir red ni credenciales) y esta solo los
 * incluye. Fundirlas dejaría la exclusión puesta y el runner no encontraría nada
 * que ejecutar.
 *
 * La lanza `scripts/contract-live.mjs`, nunca `npm test`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.live.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // El segundo simula al navegador: Managed Better Auth exige `Origin` y
    // Node no la manda. Ver su encabezado.
    setupFiles: ["./vitest.setup.ts", "./vitest.live.setup.ts"],

    // Aquí hay red de verdad: un registro contra Managed Better Auth o un
    // clonado de árbol por PostgREST no caben en los 5 s por defecto.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    // Los archivos comparten UNA cuenta y UNA base de datos, y la suite borra
    // Proyectos entre bloques. En paralelo se pisarían entre ellos y el fallo
    // parecería un bug del adaptador.
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
