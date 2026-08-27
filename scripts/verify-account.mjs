/**
 * Confirma a mano el email de la cuenta de la corrida en vivo.
 *
 *     npm run account:verify
 *
 * En producción confirmar es pinchar un enlace que llega por correo. Para una
 * cuenta de test eso obliga a tener un buzón de verdad, así que aquí se hace lo
 * que el enlace haría: marcar la cuenta como verificada, usando la conexión de
 * dueño (la que tiene BYPASSRLS y ya sirve para aplicar migraciones).
 *
 * Lo que esto NO prueba es el envío del correo, y está bien: eso es del ticket
 * de auth (#7). Lo que sí se sigue probando es que entrar SIN confirmar falla,
 * que es la garantía del spec, y eso lo afirma `signup.live.test.ts` antes.
 */

import { PROVIDERS, activeProvider, connectionString, loadEnvLocal } from "./db.mjs";

/**
 * Cómo se dice «este email está confirmado» en cada proveedor.
 *
 * No es la misma columna ni el mismo tipo: Managed Better Auth guarda un
 * booleano en `neon_auth."user"` (entrecomillada, porque `user` es palabra
 * reservada, y con la columna en camelCase), y Supabase Auth guarda una fecha en
 * `auth.users`. Es exactamente la clase de detalle por la que el preludio de
 * cada proveedor existe.
 */
const CONFIRM = {
  neon: 'update neon_auth."user" set "emailVerified" = true where email = $1',
  supabase:
    "update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email = $1",
};

loadEnvLocal();

const provider = process.argv[2] ?? activeProvider();
const email = process.env.BACKEND_CONTRACT_EMAIL?.trim();

if (!PROVIDERS[provider] || !CONFIRM[provider]) {
  console.error(
    `«${provider}» no es un Proveedor de Backend. Los que hay: ${Object.keys(CONFIRM).join(", ")}.`,
  );
  process.exit(2);
}

if (!email) {
  console.error(
    "✗ Falta BACKEND_CONTRACT_EMAIL. Es la cuenta de usar y tirar de la corrida en vivo.",
  );
  process.exit(1);
}

const { Client } = await import("pg");
const client = new Client({ connectionString: connectionString(provider) });

try {
  await client.connect();
  const { rowCount } = await client.query(CONFIRM[provider], [email]);

  if (rowCount === 0) {
    console.error(
      `✗ ${email} no tiene cuenta en ${PROVIDERS[provider].label}.` +
        "\n  Regístrala primero: npm run account:live",
    );
    process.exit(1);
  }

  console.log(
    `✓ ${email} confirmada en ${PROVIDERS[provider].label}.` +
      "\n  Ahora: npm run test:contract:live",
  );
} catch (error) {
  console.error(`✗ ${PROVIDERS[provider].label}: ${error.message}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
