/**
 * Verifica el esquema contra un motor real, sin dejar rastro.
 *
 *     node scripts/verify-schema.mjs <neon|supabase> [--applied]
 *
 * Por defecto aplica preludio + migración + verificación en una transacción y
 * hace rollback: sirve igual contra una base vacía. Con `--applied` da el
 * esquema por puesto y corre solo la verificación, que es lo que se quiere
 * después de un `db:apply`.
 */

import { PROVIDERS, loadEnvLocal, runInTransaction, schemaSql, verifySql } from "./db.mjs";

const [provider, ...flags] = process.argv.slice(2);
const applied = flags.includes("--applied");

if (!PROVIDERS[provider]) {
  console.error(`Uso: node scripts/verify-schema.mjs <${Object.keys(PROVIDERS).join("|")}> [--applied]`);
  process.exit(2);
}

loadEnvLocal();

const blocks = applied ? verifySql(provider) : [...schemaSql(provider), ...verifySql(provider)];

try {
  await runInTransaction(provider, blocks, { commit: false });
  console.log(
    `✓ ${PROVIDERS[provider].label}: verificacion_ok` +
      (applied ? " (esquema ya aplicado)" : " (esquema aplicado y rodado atrás)"),
  );
} catch (error) {
  console.error(`✗ ${PROVIDERS[provider].label}: ${error.message}`);
  process.exit(1);
}
