/**
 * Recuperar la contraseña contra el Proveedor de Backend activo, de verdad.
 *
 *     npm run test:contract:live -- reset
 *
 * Existe porque el #22 tenía dos criterios que parecían necesitar un buzón
 * —«el correo llega y su enlace abre la ruta nueva con el token» y «fijar la
 * contraseña nueva deja entrar con ella; la vieja deja de valer»— y solo el
 * primero lo necesita de verdad. El token vive en `neon_auth.verification`
 * ANTES de viajar en el correo, y con el rol dueño se puede leer de ahí: es
 * exactamente lo que el usuario copiaría del enlace.
 *
 * Lo que NO cubre, y hay que mirar a mano una vez: que el correo se entregue,
 * no acabe en spam y se lea bien. Eso no lo ve ningún script.
 *
 * La cuenta es de usar y tirar y vive en un dominio `.invalid` —reservado por
 * RFC 2606, sin DNS—, así que el intento de envío no sale a ningún sitio real.
 * Se borra al terminar, pase lo que pase.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getBackend, resetBackend } from "@/lib/backend";
import {
  ConflictError,
  RESET_TOKEN_RULE,
  UnauthenticatedError,
} from "@/lib/backend/ports";

const enabled = process.env.BACKEND_CONTRACT_LIVE === "1";
const databaseUrl = process.env.DATABASE_URL;

/** El prefijo con el que Better Auth guarda el token de recuperación. */
const PREFIX = "reset-password:";

if (!enabled || !databaseUrl) {
  // `DATABASE_URL` además de la bandera: sin el rol dueño no hay forma de leer
  // el token ni de confirmar el email, y saltar es mejor que fallar por algo
  // que no es el código.
  describe.skip("Recuperación en vivo (apagada)", () => {});
} else {
  describe(`Recuperación en vivo (${process.env.NEXT_PUBLIC_BACKEND})`, () => {
    const email = `rice0-reset-${Date.now()}@rice-zero.invalid`;
    const vieja = "contrasena-vieja-en-vivo";
    const nueva = "contrasena-nueva-en-vivo";
    const vuelta = "http://localhost:3000/reset-password";

    /** Import perezoso: `pg` es de servidor y no debe cargarse en la suite normal. */
    async function connect() {
      const { default: pg } = await import("pg");
      const client = new pg.Client({ connectionString: databaseUrl });
      await client.connect();
      return client;
    }

    let userId = "";

    beforeAll(async () => {
      resetBackend();
      const { needsEmailVerification } = await getBackend().auth.signUpWithEmail(
        { email, password: vieja },
      );
      // De paso, el mismo centinela que `signup.live.test.ts`: si el toggle de
      // la consola se apagara, esto lo delata antes que ninguna pantalla.
      expect(needsEmailVerification).toBe(true);

      const db = await connect();
      try {
        const { rows } = await db.query<{ id: string }>(
          'select id from neon_auth."user" where email = $1',
          [email],
        );
        userId = rows[0]?.id ?? "";
        expect(userId).not.toBe("");
        // Confirmar el email sin buzón, igual que `npm run account:verify`.
        await db.query(
          'update neon_auth."user" set "emailVerified" = true where id = $1',
          [userId],
        );
      } finally {
        await db.end();
      }
    }, 60_000);

    afterAll(async () => {
      // Sin rastro, falle lo que falle por arriba.
      const db = await connect();
      try {
        await db.query("delete from neon_auth.verification where value = $1", [
          userId,
        ]);
        await db.query('delete from neon_auth.session where "userId" = $1', [
          userId,
        ]);
        await db.query('delete from neon_auth.account where "userId" = $1', [
          userId,
        ]);
        await db.query('delete from neon_auth."user" where id = $1', [userId]);
      } finally {
        await db.end();
      }
    }, 60_000);

    it("recupera la contraseña de punta a punta", async () => {
      const auth = getBackend().auth;

      // La vieja entra, que es lo que hace significativo que luego no.
      const antes = await auth.signInWithEmail({ email, password: vieja });
      expect(antes.user.email).toBe(email);
      await auth.signOut();

      // Pedir el enlace no devuelve nada: no hay por dónde filtrar si la cuenta
      // existe.
      await expect(
        auth.sendPasswordReset(email, vuelta),
      ).resolves.toBeUndefined();

      // Y el token, leído de donde el proveedor lo dejó para meterlo en el
      // correo. Es literalmente lo que el usuario recibiría en la URL.
      const db = await connect();
      let token = "";
      try {
        const { rows } = await db.query<{ identifier: string }>(
          `select identifier from neon_auth.verification
           where identifier like $1 and value = $2
           order by "createdAt" desc limit 1`,
          [`${PREFIX}%`, userId],
        );
        expect(rows).toHaveLength(1);
        token = rows[0].identifier.slice(PREFIX.length);
      } finally {
        await db.end();
      }
      expect(token.length).toBeGreaterThan(0);

      await auth.resetPassword(token, nueva);

      // El puerto promete que esto no abre sesión, y la interfaz cuenta con
      // ello: la pantalla de éxito manda a «Entrar», no a /projects.
      expect(await auth.currentSession()).toBeNull();

      // El criterio del ticket, contra el proveedor real.
      await expect(
        auth.signInWithEmail({ email, password: vieja }),
      ).rejects.toThrow(UnauthenticatedError);

      const despues = await auth.signInWithEmail({ email, password: nueva });
      expect(despues.user.email).toBe(email);
      await auth.signOut();

      // Y el enlace vale una sola vez. Esta es la aserción que el mapeo de
      // errores rompía en silencio: el SDK normaliza `INVALID_TOKEN` a
      // `bad_jwt`, y sin traducirlo salía como «no hemos podido guardar la
      // contraseña» en vez de «pide otro enlace».
      await expect(auth.resetPassword(token, "otra-cosa")).rejects.toMatchObject(
        { name: ConflictError.name, rule: RESET_TOKEN_RULE },
      );
    }, 120_000);
  });
}
