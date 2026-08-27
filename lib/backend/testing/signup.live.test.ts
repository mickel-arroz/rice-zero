/**
 * Registro contra el Proveedor de Backend activo, de verdad.
 *
 * Es el primer paso de la corrida en vivo: crea la cuenta de usar y tirar que
 * `live.test.ts` necesita, y de paso ejercita la mitad de autenticación del
 * adaptador —la que ningún test en memoria puede probar, porque lo que se está
 * comprobando es el SDK del proveedor.
 *
 *     npm run account:live       # esto
 *     # …confirmas el email en tu bandeja…
 *     npm run test:contract:live # la contract suite entera
 *
 * Las dos garantías que afirma son del spec, no del SDK:
 *
 *   · registrarse NO deja sesión abierta;
 *   · entrar sin confirmar el email es imposible.
 *
 * Si el toggle «Verify at Sign-up» de la consola de Neon está apagado, este
 * archivo es lo que lo delata.
 */

import { describe, expect, it } from "vitest";

import { getBackend, resetBackend } from "@/lib/backend";
import { ConflictError, UnauthenticatedError } from "@/lib/backend/ports";

const enabled = process.env.BACKEND_CONTRACT_LIVE === "1";
const email = process.env.BACKEND_CONTRACT_EMAIL;
const password = process.env.BACKEND_CONTRACT_PASSWORD;

if (!enabled || !email || !password) {
  describe.skip("Registro en vivo (apagado)", () => {});
} else {
  describe(`Registro en vivo (${process.env.NEXT_PUBLIC_BACKEND})`, () => {
    it("registra la cuenta, o dice que ya existía", async () => {
      resetBackend();
      const backend = getBackend();

      try {
        const result = await backend.auth.signUpWithEmail({ email, password });

        // El spec exige verificación obligatoria: registrarse nunca deja
        // sesión abierta. Si esto sale `false`, el toggle «Verify at Sign-up»
        // está apagado en la consola del proveedor.
        expect(result.needsEmailVerification).toBe(true);

        console.log(
          `\n  ✓ Cuenta creada: ${email}` +
            "\n    Confirma el email desde tu bandeja y luego:" +
            "\n    npm run test:contract:live\n",
        );
      } catch (error) {
        // Que ya exista es el caso normal en la segunda corrida, y es una
        // respuesta correcta del puerto, no un fallo.
        expect(error).toBeInstanceOf(ConflictError);
        console.log(
          `\n  · ${email} ya tenía cuenta. Si ya la confirmaste:` +
            "\n    npm run test:contract:live\n",
        );
      }
    });

    it("no deja entrar mientras el email no esté confirmado", async () => {
      const backend = getBackend();
      const session = await backend.auth.currentSession();

      if (session?.user.emailVerified) {
        console.log("\n  · Email ya confirmado: esta comprobación ya no aplica.\n");
        return;
      }

      // La otra mitad de la garantía del spec. Contra el motor real, no contra
      // un doble.
      await expect(
        backend.auth.signInWithEmail({ email, password }),
      ).rejects.toThrow(UnauthenticatedError);
    });
  });
}
