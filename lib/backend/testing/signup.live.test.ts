/**
 * Registro contra el Proveedor de Backend activo, de verdad.
 *
 * Es el primer paso de la corrida en vivo: crea la cuenta de usar y tirar que
 * `contract.live.test.ts` necesita, y de paso ejercita la mitad de
 * autenticación del adaptador —la que ningún test en memoria puede probar,
 * porque lo que se está comprobando es el SDK del proveedor.
 *
 *     npm run account:live       # esto
 *     npm run account:verify     # confirma el email sin buzón
 *     npm run test:contract:live # la contract suite entera
 *
 * Las dos garantías que afirma son del spec, no del SDK:
 *
 *   · registrarse NO deja sesión abierta;
 *   · entrar sin confirmar el email es imposible.
 *
 * Si el toggle «Verify at Sign-up» de la consola del proveedor está apagado,
 * este archivo es lo que lo delata.
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

      // El `catch` va acotado a la llamada, no a las aserciones: envolverlas
      // también hacía que un assert fallido se reportara como «no era un
      // ConflictError», escondiendo lo que de verdad había fallado.
      const result = await backend.auth
        .signUpWithEmail({ email, password })
        .catch((error: unknown) => {
          // Que ya exista es el caso normal en la segunda corrida, y es una
          // respuesta correcta del puerto, no un fallo.
          if (error instanceof ConflictError) return null;
          throw error;
        });

      if (result === null) {
        console.log(
          `\n  · ${email} ya tenía cuenta.` +
            "\n    Si aún no la confirmaste: npm run account:verify\n",
        );
        return;
      }

      // El spec exige verificación obligatoria: registrarse nunca deja sesión
      // abierta. Si esto sale `false`, el toggle «Verify at Sign-up» está
      // apagado en la consola del proveedor.
      expect(result.needsEmailVerification).toBe(true);

      console.log(
        `\n  ✓ Cuenta creada: ${email}` +
          "\n    Ahora: npm run account:verify\n",
      );
    });

    it("no deja entrar mientras el email no esté confirmado", async () => {
      const backend = getBackend();

      let refused: unknown;
      try {
        await backend.auth.signInWithEmail({ email, password });
      } catch (error) {
        refused = error;
      }

      if (!refused) {
        // Entró, así que la cuenta ya está confirmada: esta garantía no aplica
        // y lo que toca es la contract suite.
        console.log("\n  · Email ya confirmado: esta comprobación ya no aplica.\n");
        return;
      }

      // La otra mitad de la garantía del spec, contra el motor real. Y también
      // que el adaptador la reporta como falta de sesión y no como un fallo de
      // red: si fuera `NetworkError`, la interfaz ofrecería «reintentar» a
      // alguien que lo que tiene que hacer es abrir su correo.
      expect(refused).toBeInstanceOf(UnauthenticatedError);
    });
  });
}
