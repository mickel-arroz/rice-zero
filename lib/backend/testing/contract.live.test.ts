/**
 * La misma contract suite, contra el Proveedor de Backend activo.
 *
 * Corre bajo demanda y no en el CI por defecto: necesita red y una cuenta de
 * verdad. El orden completo es
 *
 *     npm run account:live        # registra la cuenta
 *     npm run account:verify      # confirma el email sin buzón
 *     npm run test:contract:live  # esto
 *
 * y hacen falta tres variables (en `.env.local` o en el entorno):
 *
 *     BACKEND_CONTRACT_LIVE=1
 *     BACKEND_CONTRACT_EMAIL=…
 *     BACKEND_CONTRACT_PASSWORD=…
 *
 * ⚠ Esa cuenta es de usar y tirar. La suite BORRA todos sus Proyectos al
 * empezar cada bloque: es la única forma de que los tests sean independientes
 * contra un backend que persiste. Nunca la apuntes a una cuenta con datos que
 * te importen.
 *
 * `BACKEND_CONTRACT_LIVE` es aparte de las credenciales a propósito: unas
 * credenciales sueltas en el entorno no deben bastar para empezar a borrar.
 */

import { describe } from "vitest";

import { getBackend, resetBackend } from "@/lib/backend";
import type { BackendProvider } from "@/lib/backend/ports";
import { describeBackendContract } from "@/lib/backend/testing/contract";

const enabled = process.env.BACKEND_CONTRACT_LIVE === "1";
const email = process.env.BACKEND_CONTRACT_EMAIL;
const password = process.env.BACKEND_CONTRACT_PASSWORD;

if (!enabled || !email || !password) {
  describe.skip("Proveedor de Backend activo (apagado)", () => {});
} else {
  /**
   * Una sola sesión para toda la suite.
   *
   * Autenticarse en cada bloque parecía inofensivo —contra el adaptador en
   * memoria lo es— pero contra un servicio real son tantos logins como tests, y
   * Neon Auth contesta `429 over_request_rate_limit` a los pocos segundos. La
   * sesión no es lo que cada test necesita aislar; los datos sí.
   */
  const credentials = { email, password };

  let signedIn: Promise<BackendProvider> | null = null;

  function session(): Promise<BackendProvider> {
    signedIn ??= (async () => {
      resetBackend();
      const backend = getBackend();
      await backend.auth.signInWithEmail(credentials);
      return backend;
    })();
    return signedIn;
  }

  async function deleteEverything(backend: BackendProvider): Promise<void> {
    for (const project of await backend.projects.list()) {
      await backend.projects.delete(project.id);
    }
  }

  describeBackendContract({
    name: `activo (${process.env.NEXT_PUBLIC_BACKEND})`,
    async setUp() {
      const backend = await session();
      // Limpiar al ENTRAR y no al salir: así cada bloque arranca en blanco
      // aunque una corrida anterior se cortara a la mitad.
      await deleteEverything(backend);
      return backend;
    },
    // Nada: limpiar también al salir duplicaría las llamadas al Data API sin
    // aislar nada más. Lo que quede al final se lo lleva el primer bloque de la
    // corrida siguiente.
    tearDown: async () => {},
  });
}
