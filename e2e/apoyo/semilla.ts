/**
 * El estado de partida de la suite E2E.
 *
 * «Seed reproducible» (criterio del #20) quiere decir una cosa concreta: que la
 * corrida número cien empiece exactamente igual que la primera. Sin esto, un
 * Proyecto que dejó una corrida anterior aparece en la lista de la siguiente, y
 * entonces «hay un Proyecto en la pantalla» deja de significar «lo acabo de
 * crear».
 *
 * ── Por qué esto habla SQL y no pasa por la app ───────────────────────────
 *
 * Por el ADR 0001 el navegador habla directo con PostgREST bajo RLS, así que
 * vaciar la cuenta desde la app significaría pulsar «Borrar» en la interfaz
 * tantas veces como Proyectos hubiera — con la propia interfaz que se está
 * probando, que es la que puede estar rota. La conexión de dueño
 * (`DATABASE_URL`, con BYPASSRLS) es la misma que usan `npm run db:apply` y
 * `npm run account:verify`, y aquí hace lo mismo que allí: lo que la app no
 * tiene por qué saber hacer.
 *
 * Confirmar el email es literalmente lo que hace `scripts/verify-account.mjs`,
 * y por el mismo motivo escrito allí: en producción se confirma pinchando un
 * enlace que llega por correo, y una cuenta de test no tiene buzón. Lo que eso
 * NO prueba es el envío del correo — eso es del ticket de auth (#7), y
 * `signup.live.test.ts` ya afirma que entrar SIN confirmar falla.
 */

import { Client } from "pg";

/**
 * Cómo se dice «este email está confirmado» en Neon.
 *
 * Entrecomillada porque `user` es palabra reservada, y con la columna en
 * camelCase: es Managed Better Auth quien manda en ese esquema, no nosotros.
 * La misma sentencia que `CONFIRM.neon` en `scripts/verify-account.mjs`.
 */
const CONFIRMAR = 'update neon_auth."user" set "emailVerified" = true where email = $1';

const ID_POR_EMAIL = 'select id from neon_auth."user" where email = $1';

/** Lo que la semilla deja detrás, para que quien la llame lo pueda decir. */
export type Semilla = {
  /** Cuántos Proyectos se llevó por delante el vaciado. Solo para el informe. */
  readonly proyectosBorrados: number;
};

/** Marca la cuenta como confirmada. Idempotente: ponerla dos veces no molesta. */
async function confirmarEmail(client: Client, email: string): Promise<void> {
  const { rowCount } = await client.query(CONFIRMAR, [email]);
  if (rowCount === 0) {
    throw new Error(
      `No existe ninguna cuenta con el email «${email}». La semilla la registra antes de llegar aquí.`,
    );
  }
}

/** El id del usuario, que es lo que `projects.owner_id` guarda. */
async function idDeUsuario(client: Client, email: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(ID_POR_EMAIL, [email]);
  const id = rows[0]?.id;
  if (!id) throw new Error(`No existe ninguna cuenta con el email «${email}».`);
  return id;
}

/**
 * Borra TODOS los Proyectos de la cuenta, no solo los que la suite reconoce.
 *
 * Es la decisión del módulo, y es a propósito la más destructiva de las dos.
 * Filtrar por el prefijo `E2E` de `pantallas.ts` dejaría convivir datos ajenos,
 * pero también dejaría sobrevivir lo que la suite crea SIN prefijo —un Proyecto
 * nacido de un diálogo con el título por defecto, uno renombrado a media
 * prueba— y esos son justo los que contaminan la corrida siguiente sin que
 * nadie los reconozca al verlos. Un aislamiento que depende de que nadie se
 * olvide de poner un prefijo no es aislamiento.
 *
 * El precio está pagado por adelantado: `E2E_EMAIL` es una cuenta de usar y
 * tirar, y se dice en `.env.example`, en el README y en el guardia de
 * `scripts/e2e.mjs`. Mismo trato que la cuenta de `BACKEND_CONTRACT_LIVE`.
 */
const VACIAR = "delete from public.projects where owner_id = $1";

/**
 * Deja la cuenta como recién creada.
 *
 * @param client la conexión de dueño. Se salta RLS: no hay sesión que la limite.
 * @param ownerId el usuario cuya cuenta se vacía.
 * @returns cuántos Proyectos se borraron.
 *
 * Lo que se borra cascadea solo: `project_versions` cuelga de `projects`, y
 * `nodes` y `ai_analyses` cuelgan de las Versiones (ver
 * `db/migrations/0001_initial_schema.sql`). Basta con la tabla de arriba.
 */
async function vaciarCuenta(client: Client, ownerId: string): Promise<number> {
  // Parametrizada, nunca interpolada. Aquí importa más que en cualquier otro
  // sitio del repo: esta conexión tiene BYPASSRLS, así que un `where` que se
  // pudiera torcer no borraría los Proyectos de una cuenta — borraría los de
  // todas. El `id` viene de una consulta nuestra y aun así viaja como
  // parámetro: la regla no se salta porque el valor parezca de fiar.
  const { rowCount } = await client.query(VACIAR, [ownerId]);

  // `rowCount` es `number | null` en `pg`: nulo para sentencias que no
  // devuelven filas afectadas. Un `delete` siempre las cuenta, así que el nulo
  // no debería pasar — y se traduce a 0 en vez de dejar escapar un `null` que
  // acabaría escrito como «Proyectos borrados antes de empezar: null» en el
  // informe de la corrida. La cifra es diagnóstico, no una aserción: nada
  // depende de ella, así que redondear a la baja no esconde nada.
  return rowCount ?? 0;
}

/**
 * Deja la cuenta lista y vacía, y devuelve quién es.
 *
 * Se abre y se cierra la conexión aquí dentro: la semilla corre UNA vez por
 * corrida, en el proyecto de preparación de Playwright, y un `Client` de `pg`
 * colgando después de eso dejaría el proceso sin terminar.
 */
export async function sembrar(
  databaseUrl: string,
  email: string,
): Promise<Semilla> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await confirmarEmail(client, email);
    const userId = await idDeUsuario(client, email);
    return { proyectosBorrados: await vaciarCuenta(client, userId) };
  } finally {
    await client.end();
  }
}
