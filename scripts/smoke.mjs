/**
 * Lanza el smoke contra un despliegue.
 *
 *     SMOKE_URL=https://rice-zero.vercel.app npm run smoke
 *
 * No levanta nada y no entra con ninguna cuenta: todo lo que comprueba es
 * público. Ver la cabecera de `playwright.humo.config.ts`.
 *
 * El guardia de aquí es el mismo de siempre: sin `SMOKE_URL`, Playwright
 * correría contra `about:blank` y saldría en verde diciendo nada.
 */

import { loadEnvLocal } from "./env-local.mjs";
import { requireLiveEnv, resolveBin, runBin } from "./live-runner.mjs";

loadEnvLocal();

requireLiveEnv(["SMOKE_URL"], [
  "  Es la URL del despliegue: la de producción en Vercel, o la de un preview.",
  "",
  "      SMOKE_URL=https://tu-app.vercel.app npm run smoke",
  "",
  "  No hace falta ninguna credencial: el smoke no entra con ninguna cuenta y",
  "  no escribe nada. Eso es deliberado — es producción.",
]);

runBin(
  resolveBin("@playwright/test", "playwright"),
  ["test", "--config", "playwright.humo.config.ts", ...process.argv.slice(2)],
  "Playwright",
);
