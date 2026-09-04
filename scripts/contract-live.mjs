/**
 * Lanza una corrida en vivo contra el Proveedor de Backend activo.
 *
 *     npm run account:live        # registra la cuenta de usar y tirar
 *     npm run test:contract:live  # la contract suite entera
 *
 * Lo mecánico —exigir las variables, resolver vitest, distinguir «falló el
 * test» de «no pude ni arrancar»— es `live-runner.mjs`, compartido con
 * `ai-live.mjs`.
 */

import { loadEnvLocal } from "./env-local.mjs";
import { requireLiveEnv, runLiveVitest } from "./live-runner.mjs";

loadEnvLocal();

/** Qué corrida se pide. `signup` crea la cuenta; sin argumento, la suite. */
const TARGETS = {
  signup: "lib/backend/testing/signup.live.test.ts",
  contract: "lib/backend/testing/contract.live.test.ts",
};

const target = process.argv[2] ?? "contract";

if (!Object.hasOwn(TARGETS, target)) {
  console.error(`Uso: node scripts/contract-live.mjs [${Object.keys(TARGETS).join("|")}]`);
  process.exit(2);
}

requireLiveEnv(
  ["BACKEND_CONTRACT_LIVE", "BACKEND_CONTRACT_EMAIL", "BACKEND_CONTRACT_PASSWORD"],
  [
    "  BACKEND_CONTRACT_LIVE=1 va aparte de las credenciales a propósito: unas",
    "  credenciales sueltas no deben bastar para empezar a borrar.",
    "",
    "  ⚠ Esa cuenta es de usar y tirar. La suite BORRA todos sus Proyectos",
    "    entre bloques. Nunca la apuntes a una con datos que te importen.",
    "",
    "  El orden: npm run account:live -> confirmar el email ->",
    "  npm run test:contract:live",
  ],
);

// `--config`: la configuración de siempre EXCLUYE estos archivos para que
// `npm test` no pida red. Ver el encabezado de `vitest.live.config.ts`.
runLiveVitest("vitest.live.config.ts", TARGETS[target]);
