/**
 * Carga `.env.local`, sin dependencias.
 *
 * Lo usan los scripts de esquema y el setup de Vitest, que necesitan lo mismo
 * que `next dev` lee solo. Nunca sobreescribe lo que ya venga del entorno: en
 * CI las variables llegan por ahí y el archivo no existe.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
