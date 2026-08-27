/**
 * La misma contract suite, contra el Proveedor de Backend activo.
 *
 * Corre bajo demanda y no en el CI por defecto: necesita red y una cuenta de
 * verdad. Se enciende con
 *
 *     npm run test:contract:live
 *
 * y tres variables (en `.env.local` o en el entorno):
 *
 *     BACKEND_CONTRACT_LIVE=1
 *     BACKEND_CONTRACT_EMAIL=…
 *     BACKEND_CONTRACT_PASSWORD=…
 *
 * ⚠ Esa cuenta es de usar y tirar. La suite BORRA todos sus Proyectos entre
 * bloques: es la única forma de que los tests sean independientes contra un
 * backend que persiste. Nunca la apuntes a una cuenta con datos que te importen.
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
  async function deleteEverything(backend: BackendProvider): Promise<void> {
    for (const project of await backend.projects.list()) {
      await backend.projects.delete(project.id);
    }
  }

  describeBackendContract({
    name: `activo (${process.env.NEXT_PUBLIC_BACKEND})`,
    async setUp() {
      resetBackend();
      const backend = getBackend();
      await backend.auth.signInWithEmail({ email, password });
      await deleteEverything(backend);
      return backend;
    },
    tearDown: deleteEverything,
  });
}
