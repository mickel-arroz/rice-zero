/**
 * Aplica preludio + migración a un motor real. Persiste.
 *
 *     node scripts/apply-schema.mjs [neon|supabase]
 *
 * Sin argumento usa el proveedor activo (`NEXT_PUBLIC_BACKEND`), para que
 * cambiar de proveedor no obligue a editar `package.json`.
 *
 * Es una sola transacción: si algo falla, no queda un esquema a medias.
 */

import { PROVIDERS, activeProvider, loadEnvLocal, runInTransaction, schemaSql } from "./db.mjs";

loadEnvLocal();

const provider = process.argv[2] ?? activeProvider();

if (!PROVIDERS[provider]) {
  console.error(
    `«${provider}» no es un Proveedor de Backend. Los que hay: ${Object.keys(PROVIDERS).join(", ")}.`,
  );
  process.exit(2);
}

try {
  await runInTransaction(provider, schemaSql(provider), { commit: true });
  console.log(`✓ ${PROVIDERS[provider].label}: esquema aplicado.`);
} catch (error) {
  console.error(`✗ ${PROVIDERS[provider].label}: ${error.message}`);
  process.exit(1);
}
