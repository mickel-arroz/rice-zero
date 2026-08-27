/**
 * La biblioteca de SQL: cómo se compone el esquema y cómo se ejecuta.
 *
 * Una sola migración compartida, un preludio por Proveedor de Backend. Ver
 * `docs/adr/0001-proveedor-de-backend-intercambiable.md`.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export { loadEnvLocal } from "./env-local.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Los proveedores que tienen preludio, y de dónde sale su conexión. */
export const PROVIDERS = {
  neon: {
    label: "Neon",
    /** El rol `neondb_owner`: tiene BYPASSRLS, así que solo sirve para DDL. */
    envKey: "DATABASE_URL",
  },
  supabase: {
    label: "Supabase",
    /** La base local que levanta `supabase start`. */
    envKey: "SUPABASE_DB_URL",
    fallbackUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
};

const sql = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");

/** Preludio + migración: lo que deja el esquema en pie. */
export function schemaSql(provider) {
  return [
    sql("db", "preludes", `${provider}.sql`),
    sql("db", "migrations", "0001_initial_schema.sql"),
  ];
}

/**
 * Alta de los usuarios de prueba + la verificación compartida. Va después del
 * esquema y dentro de la misma transacción.
 */
export function verifySql(provider) {
  return [
    sql("db", "tests", "identity.sql"),
    sql("db", "tests", provider, "users.sql"),
    sql("db", "tests", "verify_rls_and_clone.sql"),
  ];
}

/**
 * Cadena de conexión del proveedor. Nunca la imprime: es una credencial y los
 * mensajes de error acaban en logs.
 */
export function connectionString(provider) {
  const { envKey, fallbackUrl, label } = PROVIDERS[provider];
  const value = process.env[envKey]?.trim();
  if (value) return value;
  if (fallbackUrl) return fallbackUrl;
  throw new Error(
    `Falta ${envKey}. Es la conexión de DDL de ${label}; sácala de su wizard.`,
  );
}

/**
 * Ejecuta los bloques dentro de una transacción. `commit: false` deja la base
 * como estaba, que es lo que permite verificar contra el motor real sin
 * escribir nada.
 */
export async function runInTransaction(provider, blocks, { commit }) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: connectionString(provider) });
  await client.connect();
  try {
    await client.query("begin");
    for (const block of blocks) await client.query(block);
    await client.query(commit ? "commit" : "rollback");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
