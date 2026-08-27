/**
 * Aplica preludio + migración a un motor real. Persiste.
 *
 *     node scripts/apply-schema.mjs <neon|supabase>
 *
 * Es una sola transacción: si algo falla, no queda un esquema a medias.
 */

import { PROVIDERS, loadEnvLocal, runInTransaction, schemaSql } from "./db.mjs";

const provider = process.argv[2];

if (!PROVIDERS[provider]) {
  console.error(`Uso: node scripts/apply-schema.mjs <${Object.keys(PROVIDERS).join("|")}>`);
  process.exit(2);
}

loadEnvLocal();

try {
  await runInTransaction(provider, schemaSql(provider), { commit: true });
  console.log(`✓ ${PROVIDERS[provider].label}: esquema aplicado.`);
} catch (error) {
  console.error(`✗ ${PROVIDERS[provider].label}: ${error.message}`);
  process.exit(1);
}
