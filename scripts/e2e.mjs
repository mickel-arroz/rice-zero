/**
 * Lanza la suite E2E contra el Proveedor de Backend activo.
 *
 *     npm run test:e2e            # todo
 *     npm run test:e2e -- --ui    # el modo interactivo de Playwright
 *
 * El guardia de las variables está aquí y no solo dentro de Playwright por lo
 * mismo que en `contract-live.mjs`: un corredor de tests sin credenciales sale
 * en VERDE habiendo ejecutado cero pruebas, y eso parece una suite superada. La
 * LISTA de lo que hace falta vive en `e2e-env.mjs`, compartida con el módulo
 * de TypeScript que la usa dentro de Playwright; aquí solo se lee y se dice.
 *
 * ⚠ La cuenta de `E2E_EMAIL` es de usar y tirar: la semilla BORRA todos sus
 *   Proyectos antes de cada corrida.
 */

import { E2E_KEYS } from "./e2e-env.mjs";
import { loadEnvLocal } from "./env-local.mjs";
import { requireLiveEnv, resolveBin, runBin } from "./live-runner.mjs";

loadEnvLocal();

requireLiveEnv(E2E_KEYS, [
  "  E2E_LIVE=1 va aparte de las credenciales a propósito: unas credenciales",
  "  sueltas no deben bastar para empezar a borrar.",
  "",
  "  ⚠ La cuenta de E2E_EMAIL es de usar y tirar. La semilla BORRA todos sus",
  "    Proyectos antes de cada corrida. Nunca la apuntes a una con datos que",
  "    te importen.",
  "",
  "  DATABASE_URL es la del rol dueño: con ella la semilla confirma el email y",
  "  vacía la cuenta, igual que hacen `npm run db:apply` y `account:verify`.",
  "",
  "  El Proveedor de IA lo fuerza la propia configuración a `falso`: la suite",
  "  no puede gastar cuota.",
]);

/**
 * El atajo tiene precio: si traes tu propio servidor, lo arrancas tú, y con él
 * te llevas la responsabilidad del Proveedor de IA.
 *
 * `playwright.config.ts` fuerza `AI_PROVIDER=falso` en el servidor que levanta
 * ÉL. `E2E_BASE_URL` se salta ese servidor entero, así que sin esta comprobación
 * el criterio «la suite nunca gasta cuota real» dependería de que alguien se
 * acordara. Se mira el entorno de quien lanza porque es el mismo del que sale
 * `next start` en la práctica; no es una prueba, es un recordatorio que para la
 * corrida en vez de dejarla empezar.
 */
if (process.env.E2E_BASE_URL?.trim() && process.env.AI_PROVIDER?.trim() !== "falso") {
  console.error(
    [
      "✗ E2E_BASE_URL está puesta, así que la suite va a usar TU servidor.",
      "  Arráncalo con el Proveedor de IA falso, y lánzala con lo mismo:",
      "",
      "      AI_PROVIDER=falso npx next start --port 3100",
      "      AI_PROVIDER=falso E2E_BASE_URL=http://localhost:3100 npm run test:e2e",
      "",
      "  Sin eso, generar un Análisis llamaría a Gemini de verdad. Quita",
      "  E2E_BASE_URL si prefieres que Playwright levante el suyo.",
    ].join("\n"),
  );
  process.exit(1);
}

runBin(
  resolveBin("@playwright/test", "playwright"),
  ["test", "--config", "playwright.config.ts", ...process.argv.slice(2)],
  "Playwright",
);
