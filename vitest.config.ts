import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Las corridas en vivo se lanzan a mano (`npm run account:live`,
    // `npm run test:contract:live`): piden red y una cuenta de verdad, así que
    // no forman parte de `npm test`. Se autoexcluyen con `describe.skip`, pero
    // excluirlas aquí ahorra levantar el adaptador para nada.
    exclude: ["node_modules/**", ".next/**", "**/*.live.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
