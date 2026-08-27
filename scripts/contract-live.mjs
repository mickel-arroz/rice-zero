/**
 * Lanza la contract suite contra el Proveedor de Backend activo.
 *
 *     npm run test:contract:live
 *
 * Existe para que este comando no pueda mentir. `vitest run live.test.ts` a
 * secas sale en verde habiendo ejecutado CERO tests cuando faltan las
 * credenciales, que es la peor respuesta posible: parece una prueba superada.
 * Aquí se comprueba antes y se falla con lo que hay que hacer.
 */

import { spawnSync } from "node:child_process";

import { loadEnvLocal } from "./env-local.mjs";

loadEnvLocal();

const REQUIRED = [
  "BACKEND_CONTRACT_LIVE",
  "BACKEND_CONTRACT_EMAIL",
  "BACKEND_CONTRACT_PASSWORD",
];

const missing = REQUIRED.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.error(
    [
      "✗ La corrida en vivo necesita una cuenta de verdad y no está configurada.",
      `  Faltan en .env.local o en el entorno: ${missing.join(", ")}`,
      "",
      "  BACKEND_CONTRACT_LIVE=1 va aparte de las credenciales a propósito: unas",
      "  credenciales sueltas no deben bastar para empezar a borrar.",
      "",
      "  ⚠ Esa cuenta es de usar y tirar. La suite BORRA todos sus Proyectos",
      "    entre bloques. Nunca la apuntes a una con datos que te importen.",
    ].join("\n"),
  );
  process.exit(1);
}

const { status } = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vitest", "run", "lib/backend/testing/live.test.ts"],
  { stdio: "inherit" },
);

process.exit(status ?? 1);
