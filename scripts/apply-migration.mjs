/**
 * Aplica UNA migración sobre una base que ya tiene esquema.
 *
 *     node scripts/apply-migration.mjs 0002 [neon|supabase] [--check]
 *
 * `db:apply` levanta el esquema entero desde cero y por eso no sirve aquí: la
 * base de Neon ya está en pie y con datos, así que volver a pasar `0001`
 * fallaría en el primer `create table`. Este script coge la migración cuyo
 * nombre empieza por el prefijo que se le pase y la aplica sola.
 *
 * Con `--check` corre dentro de una transacción y hace rollback: dice si la
 * migración pasa contra el motor real sin dejar rastro. Sin él, hace commit.
 *
 * El preludio no se vuelve a aplicar: sus funciones ya existen y son
 * `create or replace`, pero tampoco hacen falta — una migración aditiva no
 * redefine la identidad, solo la usa.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDERS, activeProvider, loadEnvLocal, runInTransaction } from "./db.mjs";

loadEnvLocal();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = join(ROOT, "db", "migrations");

const args = process.argv.slice(2);
const check = args.includes("--check");
const [prefix, providerArg] = args.filter((arg) => !arg.startsWith("--"));

if (!prefix) {
  console.error("Uso: node scripts/apply-migration.mjs <prefijo> [neon|supabase] [--check]");
  process.exit(2);
}

const provider = providerArg ?? activeProvider();

if (!PROVIDERS[provider]) {
  console.error(
    `«${provider}» no es un Proveedor de Backend. Los que hay: ${Object.keys(PROVIDERS).join(", ")}.`,
  );
  process.exit(2);
}

// Por prefijo y no por nombre completo: `0002` basta, y así renombrar el resto
// del archivo no rompe el comando que quedó escrito en un ticket.
const matches = readdirSync(MIGRATIONS).filter(
  (name) => name.endsWith(".sql") && name.startsWith(prefix),
);

if (matches.length !== 1) {
  console.error(
    matches.length === 0
      ? `Ninguna migración empieza por «${prefix}».`
      : `«${prefix}» encaja con varias: ${matches.join(", ")}.`,
  );
  process.exit(2);
}

const [name] = matches;
const sql = readFileSync(join(MIGRATIONS, name), "utf8");
const { label } = PROVIDERS[provider];

try {
  await runInTransaction(provider, [sql], { commit: !check });
  console.log(
    check
      ? `✓ ${label}: ${name} pasa (y se ha rodado atrás).`
      : `✓ ${label}: ${name} aplicada.`,
  );
} catch (error) {
  console.error(`✗ ${label}: ${error.message}`);
  process.exit(1);
}
