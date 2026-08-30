/**
 * La capa de servicios de Versiones.
 *
 * Mismo contrato que `projects.ts` y `nodes.ts` (ADR 0001): «cero llamadas al
 * backend desde componentes o páginas». Una fábrica sobre un `BackendProvider`
 * para poder probarla, y un atajo sobre el proveedor activo.
 *
 * Lo que este servicio añade sobre el repositorio son tres cosas, y ninguna es
 * indirección por sí misma:
 *
 *   · **La etiqueta se normaliza en un solo sitio.** «En blanco» y «ausente»
 *     son lo mismo para una persona, así que aquí se convierten en lo mismo
 *     —`null`— antes de que el motor vea la diferencia.
 *   · **Los límites se comprueban antes de gastar un viaje al motor**, y el
 *     rechazo sale en español en vez de como un 23514.
 *
 * Lo que NO añade, a propósito: la regla de «no puedes borrar la última». Esa
 * vive en el puerto (`adapters/postgrest/kernel.ts`), que es donde se puede
 * contar cuántas quedan sin una lectura de más. Copiarla aquí serían dos
 * sitios que decidir lo mismo esperando a que alguien toque uno; lo que sí se
 * prueba aquí es que el rechazo LLEGA a quien llama al servicio.
 */

import { getBackend } from "@/lib/backend";
import {
  ConflictError,
  NotFoundError,
  type BackendProvider,
  type ProjectVersion,
} from "@/lib/backend/ports";

/**
 * Lo que cabe en una etiqueta.
 *
 * La autoridad sigue siendo el `check` de la migración —`char_length(btrim(
 * label)) between 1 and 120`—: esto es una copia, declarada aquí para que el
 * campo pueda cortar antes de escribir. Ver `PROJECT_LIMITS`.
 */
export const VERSION_LIMITS = {
  labelMax: 120,
} as const;

/** Los mensajes de los rechazos, todos en un sitio. Ver `PROJECT_ERRORS`. */
export const VERSION_ERRORS = {
  labelLong: `La etiqueta no puede pasar de ${VERSION_LIMITS.labelMax} caracteres.`,
} as const;

export type VersionService = {
  /**
   * Las Versiones de un Proyecto, de la más nueva a la más vieja.
   *
   * Es además lo que valida la Versión que viaja en la URL desde #14: una URL
   * se edita a mano, y buscar el id EN ESTA LISTA responde de una vez a las
   * tres preguntas —¿existe?, ¿es tuya?, ¿es de este Proyecto?— sin una
   * consulta de más. Una lista vacía es «el Proyecto no existe o no es tuyo»,
   * que de cara afuera son lo mismo (ver `lib/backend/ports/errors.ts`).
   */
  list(projectId: string): Promise<ProjectVersion[]>;
  /**
   * La Versión que se abre al entrar en un Proyecto sin decir cuál: la más
   * reciente.
   *
   * Es una decisión de producto y no una consulta: `/projects/[id]` redirige
   * aquí, y «la que abres» tiene que ser una sola y siempre la misma.
   *
   * @throws NotFoundError si el Proyecto no existe, no es tuyo, o —cosa que no
   * debería poder pasar— se quedó sin ninguna Versión.
   */
  active(projectId: string): Promise<ProjectVersion>;
  /**
   * Un snapshot profundo e independiente del árbol, con etiqueta nueva.
   *
   * Sin merge, nunca: `sourceVersionId` es procedencia y nada más.
   *
   * @throws ConflictError si la etiqueta no cabe · @throws NotFoundError
   */
  clone(id: string, label?: string | null): Promise<ProjectVersion>;
  /** @throws ConflictError si la etiqueta no cabe · @throws NotFoundError */
  rename(id: string, label: string | null): Promise<ProjectVersion>;
  /**
   * @throws NotFoundError
   * @throws ConflictError si es la última Versión que le queda al Proyecto.
   */
  remove(id: string): Promise<void>;
};

/** Cómo se nombra una Versión en un `NotFoundError`. Ver `NODE_RESOURCE`. */
const VERSION_RESOURCE = "la Versión";

/**
 * Recorta la etiqueta: en blanco es lo mismo que sin etiqueta.
 *
 * Una Versión sin etiqueta se llama por su número, así que vaciar el campo no
 * es un error — es volver al nombre de nacimiento.
 */
function normalizeLabel(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const label = raw.trim();
  if (label.length > VERSION_LIMITS.labelMax) {
    // `ConflictError` por lo mismo que en `projects.ts`: la taxonomía del
    // puerto son las decisiones que la interfaz puede tomar, y «esto choca con
    // una regla» ya es una de ellas.
    throw new ConflictError("etiqueta-larga", VERSION_ERRORS.labelLong);
  }
  return label || null;
}

export function createVersionService(backend: BackendProvider): VersionService {
  return {
    list(projectId) {
      return backend.versions.listByProject(projectId);
    },

    async active(projectId) {
      const [newest] = await backend.versions.listByProject(projectId);
      // Una lista vacía significa una de dos: el Proyecto no es tuyo y la RLS
      // devolvió cero filas, o el Proyecto no existe. Las dos son lo mismo de
      // cara afuera —ver `lib/backend/ports/errors.ts`—, y la tercera
      // posibilidad, un Proyecto sin Versiones, la impide el alta.
      if (!newest) throw new NotFoundError(VERSION_RESOURCE, projectId);
      return newest;
    },

    // `async` aunque el cuerpo solo delegue: `normalizeLabel` lanza
    // SÍNCRONAMENTE, y en un método que devuelve una promesa eso es una trampa
    // — el `.catch()` del llamante no llega a existir. Ver `projects.ts`.
    async clone(id, label) {
      return backend.versions.clone(id, normalizeLabel(label));
    },

    async rename(id, label) {
      return backend.versions.rename(id, normalizeLabel(label));
    },

    remove(id) {
      return backend.versions.delete(id);
    },
  };
}

/** El servicio sobre el Proveedor de Backend activo. Sin memoizar. */
export function versionService(): VersionService {
  return createVersionService(getBackend());
}
