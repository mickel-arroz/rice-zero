/**
 * Carga `.env.local` antes de los tests, igual que hace `next dev`.
 *
 * Existe por la corrida en vivo de la contract suite
 * (`lib/backend/testing/live.test.ts`), que necesita las credenciales del
 * proveedor activo. No sobreescribe nada que ya venga del entorno: en CI las
 * variables llegan por ahí y el archivo no existe.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

try {
  const raw = readFileSync(fileURLToPath(new URL("./.env.local", import.meta.url)), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // Sin `.env.local` no hay nada que cargar, y la mayoría de los tests no lo
  // necesitan.
}
