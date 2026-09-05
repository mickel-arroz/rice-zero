/**
 * Lo común de las corridas EN VIVO: exigir credenciales y lanzar vitest.
 *
 * Existe una sola vez por lo mismo que `wizard-lib.sh`: `contract-live.mjs` y
 * `ai-live.mjs` hacían literalmente las mismas cuatro cosas —comprobar las
 * variables, resolver el binario de vitest, lanzarlo con su configuración,
 * distinguir «falló el test» de «no pude ni arrancar»— y dos copias de eso se
 * desincronizan en cuanto alguien arregla un caso raro en una.
 *
 * Lo que NO está aquí es POR QUÉ cada corrida existe ni qué variables pide:
 * eso es propio de cada una, y es lo único que queda en sus archivos.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Exige las variables, o se rinde diciendo cuáles faltan y qué hacer.
 *
 * Existe porque `vitest run` a secas sale en VERDE habiendo ejecutado cero
 * tests cuando faltan las credenciales, y eso es la peor respuesta posible:
 * parece una prueba superada. Aquí se comprueba antes y se falla.
 *
 * @param keys las variables obligatorias.
 * @param help las líneas que se imprimen debajo, propias de cada corrida.
 */
export function requireLiveEnv(keys, help) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return;

  console.error(
    [
      "✗ La corrida en vivo no está configurada.",
      `  Faltan en .env.local o en el entorno: ${missing.join(", ")}`,
      "",
      ...help,
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Dónde está el binario de un paquete.
 *
 * Se resuelve el `package.json` y se lee su `bin`: el entrypoint del binario no
 * está en el mapa de `exports`, así que pedirlo por subpath falla.
 *
 * @param pkg el paquete (`vitest`, `@playwright/test`).
 * @param bin qué entrada de su `bin` se quiere, cuando hay varias.
 */
export function resolveBin(pkg, bin = pkg) {
  const require = createRequire(import.meta.url);
  try {
    const manifest = require.resolve(`${pkg}/package.json`);
    const declared = require(manifest).bin;
    return join(
      dirname(manifest),
      typeof declared === "string" ? declared : declared[bin],
    );
  } catch {
    console.error(`✗ No encuentro ${pkg}. ¿Falta \`npm install\`?`);
    process.exit(1);
  }
}

/**
 * Lanza un binario del repo con el mismo Node que corre esto, y sale con su
 * código.
 *
 * Se lanza `node` contra el entrypoint, no `npx`. En Windows `npx` es un
 * `.cmd`, y desde Node 20 lanzar un `.cmd` sin `shell: true` devuelve EINVAL
 * (endurecimiento por CVE-2024-27980). Resolver el binario y ejecutarlo con el
 * mismo Node no depende del shell ni del PATH, así que se comporta igual en las
 * tres plataformas.
 */
export function runBin(entry, args, nombre) {
  const { status, error } = spawnSync(process.execPath, [entry, ...args], {
    stdio: "inherit",
  });

  // Sin esto, un fallo al ARRANCAR el proceso salía sin imprimir nada: el
  // comando parecía no hacer nada en vez de decir qué pasó. Es justo lo que
  // estos scripts existen para evitar.
  if (error) {
    console.error(`✗ No pude lanzar ${nombre}: ${error.message}`);
    process.exit(1);
  }

  process.exit(status ?? 1);
}

/**
 * Lanza vitest con esa configuración y ese archivo. Ver `runBin`.
 */
export function runLiveVitest(config, target) {
  runBin(resolveBin("vitest"), ["run", "--config", config, target], "vitest");
}
