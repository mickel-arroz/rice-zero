/**
 * La capa de servicios de Versiones.
 *
 * Tiene UNA operación, y es a propósito: listar, clonar, renombrar y borrar
 * son el ticket de Versiones (#14), y un método que todavía no llama nadie es
 * superficie que hay que sostener a cambio de nada. Esto existe porque la
 * Vista Registro edita el árbol de UNA Versión y necesita saber cuál, y el ADR
 * 0001 no deja que la pantalla se lo pregunte al backend por su cuenta.
 *
 * Mismo contrato que `projects.ts` y `nodes.ts`: una fábrica sobre un
 * `BackendProvider` para poder probarla, y un atajo sobre el proveedor activo.
 */

import { getBackend } from "@/lib/backend";
import {
  NotFoundError,
  type BackendProvider,
  type ProjectVersion,
} from "@/lib/backend/ports";

export type VersionService = {
  /**
   * La Versión que se abre al entrar en un Proyecto: la más reciente.
   *
   * Es una decisión de producto y no una consulta: mientras no exista el
   * selector de Versiones (#14), «la que abres» tiene que ser una sola y
   * siempre la misma, y la más nueva es donde el usuario dejó de escribir.
   *
   * @throws NotFoundError si el Proyecto no existe, no es tuyo, o —cosa que no
   * debería poder pasar— se quedó sin ninguna Versión.
   */
  active(projectId: string): Promise<ProjectVersion>;
};

/** Cómo se nombra una Versión en un `NotFoundError`. Ver `NODE_RESOURCE`. */
const VERSION_RESOURCE = "la Versión";

export function createVersionService(backend: BackendProvider): VersionService {
  return {
    async active(projectId) {
      const [newest] = await backend.versions.listByProject(projectId);
      // Una lista vacía significa una de dos: el Proyecto no es tuyo y la RLS
      // devolvió cero filas, o el Proyecto no existe. Las dos son lo mismo de
      // cara afuera —ver `lib/backend/ports/errors.ts`—, y la tercera
      // posibilidad, un Proyecto sin Versiones, la impide el alta.
      if (!newest) throw new NotFoundError(VERSION_RESOURCE, projectId);
      return newest;
    },
  };
}

/** El servicio sobre el Proveedor de Backend activo. Sin memoizar. */
export function versionService(): VersionService {
  return createVersionService(getBackend());
}
