/**
 * Lanza una corrida en vivo contra el Proveedor de Backend activo.
 *
 *     npm run account:live        # registra la cuenta de usar y tirar
 *     npm run test:contract:live  # la contract suite entera
 *
 * Existe para que estos comandos no puedan mentir. `vitest run` a
 * secas sale en verde habiendo ejecutado CERO tests cuando faltan las
 * credenciales, que es la peor respuesta posible: parece una prueba superada.
 * Aquí se comprueba antes y se falla con lo que hay que hacer.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { loadEnvLocal } from "./env-local.mjs";

loadEnvLocal();

const REQUIRED = [
  "BACKEND_CONTRACT_LIVE",
  "BACKEND_CONTRACT_EMAIL",
  "BACKEND_CONTRACT_PASSWORD",
];

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
      "",
      "  El orden: npm run account:live -> confirmar el email ->",
      "  npm run test:contract:live",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Se lanza `node` contra el entrypoint de vitest, no `npx`.
 *
 * En Windows `npx` es un `.cmd`, y desde Node 20 lanzar un `.cmd` sin
 * `shell: true` devuelve EINVAL (endurecimiento por CVE-2024-27980). Resolver
 * el binario y ejecutarlo con el mismo Node que corre esto no depende del shell
 * ni del PATH, así que se comporta igual en las tres plataformas.
 */
const require = createRequire(import.meta.url);

let vitestBin;
try {
  // Se resuelve el `package.json` y se lee su `bin`: el entrypoint del binario
  // no está en el mapa de `exports`, así que pedirlo por subpath falla.
  const manifest = require.resolve("vitest/package.json");
  const { bin } = require(manifest);
  vitestBin = join(dirname(manifest), typeof bin === "string" ? bin : bin.vitest);
} catch {
  console.error("✗ No encuentro vitest. ¿Falta `npm install`?");
  process.exit(1);
}

const { status, error } = spawnSync(
  process.execPath,
  // `--config`: la configuración de siempre excluye estos archivos para que
  // `npm test` no pida red. Ver el encabezado de `vitest.live.config.ts`.
  [vitestBin, "run", "--config", "vitest.live.config.ts", TARGETS[target]],
  { stdio: "inherit" },
);

// Sin esto, un fallo al ARRANCAR el proceso salía sin imprimir nada: el
// comando parecía no hacer nada en vez de decir qué pasó. Es justo lo que este
// script existe para evitar.
if (error) {
  console.error(`✗ No pude lanzar vitest: ${error.message}`);
  process.exit(1);
}

process.exit(status ?? 1);
