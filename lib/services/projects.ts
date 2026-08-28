/**
 * La capa de servicios de Proyectos.
 *
 * El spec la exige y el ADR 0001 explica por qué: «cero llamadas al backend
 * desde componentes o páginas». Ningún componente importa `getBackend`; todos
 * pasan por aquí. Lo que gana el proyecto a cambio de la indirección es un
 * sitio —uno— donde vive todo lo que no es ni pintar ni persistir:
 *
 *   · el catálogo de iconos, que es de la INTERFAZ y no del puerto;
 *   · la normalización de lo que el usuario escribe (recortar, vaciar a nulo);
 *   · los límites, comprobados antes de gastar un viaje al motor.
 *
 * Es una fábrica y no un puñado de funciones sueltas para que los tests puedan
 * pasarle el adaptador en memoria. La app usa `projectService()`, que le da el
 * del Proveedor de Backend activo.
 */

import {
  DEFAULT_PROJECT_ICON,
  isProjectIconKey,
} from "@/components/icons/projects";
import { getBackend } from "@/lib/backend";
import {
  ConflictError,
  type BackendProvider,
  type NewProject,
  type Project,
  type ProjectOverview,
  type ProjectPatch,
} from "@/lib/backend/ports";

/**
 * Lo que cabe en un Proyecto.
 *
 * La autoridad sigue siendo el `check` de la migración: esto es una copia, y se
 * declara aquí para que el formulario pueda cortar antes de escribir y para que
 * el error salga en español en vez de como un 23514 del motor. Si alguna vez
 * divergen, gana el motor — y la contract suite lo notará.
 */
export const PROJECT_LIMITS = {
  titleMax: 200,
  descriptionMax: 2000,
} as const;

/** Los mensajes de los rechazos, todos en un sitio. Ver `AUTH_COPY`. */
export const PROJECT_ERRORS = {
  titleEmpty: "El título no puede estar vacío.",
  titleLong: `El título no puede pasar de ${PROJECT_LIMITS.titleMax} caracteres.`,
  descriptionLong: `La descripción no puede pasar de ${PROJECT_LIMITS.descriptionMax} caracteres.`,
  unknownIcon: "Ese icono no está en el catálogo.",
} as const;

export type NewProjectInput = {
  title: string;
  description?: string | null;
  icon?: string;
};

export type ProjectPatchInput = {
  title?: string;
  description?: string | null;
  icon?: string;
};

export type ProjectService = {
  /** La lista de la pantalla: cada Proyecto con sus cifras, en una consulta. */
  list(): Promise<ProjectOverview[]>;
  /** Nace con su Versión inicial. @throws ConflictError si algo no encaja. */
  create(input: NewProjectInput): Promise<Project>;
  /** @throws ConflictError · @throws NotFoundError */
  update(id: string, patch: ProjectPatchInput): Promise<Project>;
  /** Se lleva sus Versiones, Nodos y Análisis. @throws NotFoundError */
  remove(id: string): Promise<void>;
};

function reject(rule: string, message: string): never {
  // `ConflictError` y no un error nuevo: la taxonomía del puerto son las cinco
  // decisiones que la interfaz puede tomar, y «esto choca con una regla, así
  // que reintentar tal cual no arregla nada» ya es una de ellas. Una sexta
  // categoría no le daría a nadie una decisión distinta.
  throw new ConflictError(rule, message);
}

/** Recorta y comprueba el título. Un título es obligatorio siempre. */
function requireTitle(raw: string): string {
  const title = raw.trim();
  if (title.length === 0) reject("titulo-vacio", PROJECT_ERRORS.titleEmpty);
  if (title.length > PROJECT_LIMITS.titleMax) {
    reject("titulo-largo", PROJECT_ERRORS.titleLong);
  }
  return title;
}

/**
 * Normaliza la descripción: en blanco es lo mismo que ausente.
 *
 * Devuelve `undefined` cuando no hay nada que decir, para que el parche siga
 * distinguiendo «no la toques» de «ponla a nulo» — que es la distinción que el
 * puerto hace con `undefined` frente a `null`.
 */
function normalizeDescription(raw: string | null | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const description = raw.trim();
  if (description.length > PROJECT_LIMITS.descriptionMax) {
    reject("descripcion-larga", PROJECT_ERRORS.descriptionLong);
  }
  return description || null;
}

/**
 * Comprueba la clave del icono contra el catálogo.
 *
 * ESTE es el cerrojo. El motor solo garantiza que hay texto y que no es una
 * novela, porque el catálogo canónico vive en TypeScript para que sumar un
 * icono sea un cambio de código y no una migración (ver
 * `components/icons/projects/index.ts`). El precio de esa decisión se paga
 * aquí, en la única puerta por la que se escribe.
 *
 * Al LEER no hay cerrojo equivalente y es deliberado: una fila con una clave
 * desconocida —escrita por una versión anterior o a mano— cae al icono por
 * defecto en `projectIconFor` en vez de tumbar la lista entera.
 */
function requireIcon(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const icon = raw.trim();
  if (icon.length === 0) return DEFAULT_PROJECT_ICON;
  if (!isProjectIconKey(icon)) reject("icono-desconocido", PROJECT_ERRORS.unknownIcon);
  return icon;
}

export function createProjectService(backend: BackendProvider): ProjectService {
  return {
    list() {
      return backend.projects.listOverviews();
    },

    // `async` aunque el cuerpo no espere nada suyo: la validación lanza
    // SÍNCRONAMENTE, y en un método que devuelve una promesa eso es una trampa
    // — el `.catch()` del llamante no llega a existir y el error sube por otro
    // camino. Con `async`, todo fallo del servicio es un rechazo.
    async create(input) {
      // Todo se valida ANTES de la primera escritura: así un icono inválido no
      // deja un Proyecto a medias, y el usuario no gasta un viaje al motor
      // para que le digan lo que ya se sabía.
      const values: NewProject = {
        title: requireTitle(input.title),
        description: normalizeDescription(input.description) ?? null,
        icon: requireIcon(input.icon) ?? DEFAULT_PROJECT_ICON,
      };
      return backend.projects.create(values);
    },

    async update(id, patch) {
      const values: ProjectPatch = {
        title: patch.title === undefined ? undefined : requireTitle(patch.title),
        description: normalizeDescription(patch.description),
        icon: requireIcon(patch.icon),
      };
      return backend.projects.update(id, values);
    },

    remove(id) {
      return backend.projects.delete(id);
    },
  };
}

/**
 * El servicio sobre el Proveedor de Backend activo.
 *
 * Sin memoizar: `getBackend()` ya lo está y el servicio no guarda estado, así
 * que construirlo es armar un objeto con cuatro cierres. Perezoso sí, por lo
 * mismo que el proveedor — nada se construye al importar el módulo, para que la
 * app siga renderizando aunque falte configuración.
 */
export function projectService(): ProjectService {
  return createProjectService(getBackend());
}
