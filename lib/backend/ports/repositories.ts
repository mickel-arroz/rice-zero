/**
 * Los repositorios del Proveedor de Backend: un puerto por entidad.
 *
 * Hablan en términos de dominio y no de tablas, filas ni protocolo. Lo que no
 * se ve aquí es tan importante como lo que se ve:
 *
 *   · No hay realtime. Ningún adaptador lo necesita y solo uno podría
 *     implementarlo, así que no está en el puerto.
 *   · No hay `ownerId` en ninguna entrada. La propiedad la pone el motor a
 *     partir de la sesión (RLS); un parámetro sería una invitación a mentir.
 *   · No hay `find(): T | null`. Un recurso que no está —o no es tuyo— es
 *     `NotFoundError`, y esa es toda la información que se da.
 */

import type {
  Analysis,
  AnalysisFeature,
  FeaturePrompt,
  Project,
  ProjectOverview,
  ProjectVersion,
  TreeNode,
} from "@/lib/backend/ports/entities";

export type NewProject = {
  title: string;
  description?: string | null;
  /** Ausente = el icono por defecto. Ver `Project.icon` sobre por qué es `string`. */
  icon?: string;
};

export type ProjectPatch = {
  title?: string;
  description?: string | null;
  icon?: string;
};

export interface ProjectRepository {
  /** Los Proyectos del usuario, del más recientemente tocado al más viejo. */
  list(): Promise<Project[]>;
  /**
   * Lo mismo, con las cifras de cada Proyecto y ordenado por última actividad.
   *
   * Está en el puerto y no resuelto a base de llamar a `list()` y contar porque
   * el coste es la razón de existir: son cuatro agregados por Proyecto, y
   * pedirlos uno a uno es N+1 sobre la lista entera. Cada adaptador promete
   * resolverlo en UNA consulta.
   */
  listOverviews(): Promise<ProjectOverview[]>;
  /** @throws NotFoundError si no existe o no es tuyo. */
  get(id: string): Promise<Project>;
  /**
   * Da de alta el Proyecto **y su Versión inicial**, de forma atómica.
   *
   * Las dos cosas, y no solo la primera, porque «todo Proyecto nace con una
   * Versión» es una invariante del dominio: un Proyecto sin Versiones es un
   * estado que la app no sabe dibujar. Dejarlo en manos del llamante lo
   * convertiría en una regla que hay que recordar, y con dos escrituras
   * separadas no habría forma de sostenerla si la segunda falla.
   *
   * La Versión inicial nace sin etiqueta: su nombre es su número.
   */
  create(input: NewProject): Promise<Project>;
  /** @throws NotFoundError */
  update(id: string, patch: ProjectPatch): Promise<Project>;
  /** Se lleva sus Versiones, Nodos y Análisis. @throws NotFoundError */
  delete(id: string): Promise<void>;
}

export type NewProjectVersion = {
  projectId: string;
  label?: string | null;
};

/**
 * Por qué no se puede borrar la última Versión que le queda a un Proyecto.
 *
 * Vive en el PUERTO y no en la copia de la pantalla porque el puerto es quien
 * aplica la regla y quien lanza el `ConflictError` con esta frase — es quien
 * puede contar cuántas quedan sin una lectura de más. La interfaz la lee de
 * aquí para deshabilitar el botón ANTES de intentarlo, de modo que el «no
 * puedes» dicho a la cara y el rechazo del servicio sean literalmente el mismo
 * texto. Dos copias acabarían diciendo cosas distintas.
 *
 * «Clona ésta» y no «crea otra» porque clonar es la única forma que hay de
 * conseguir una segunda Versión: no existe un «Versión en blanco» en la
 * interfaz, y mandar a alguien a una puerta que no está es peor que no decir
 * nada.
 */
export const LAST_VERSION_MESSAGE =
  "Un Proyecto no puede quedarse sin Versiones. Clona ésta antes de borrarla.";

export interface VersionRepository {
  /** Las Versiones de un Proyecto, de la más nueva a la más vieja. */
  listByProject(projectId: string): Promise<ProjectVersion[]>;
  /** @throws NotFoundError */
  get(id: string): Promise<ProjectVersion>;
  create(input: NewProjectVersion): Promise<ProjectVersion>;
  /**
   * Snapshot profundo e independiente del árbol de una Versión. No copia
   * Análisis: pertenecen a la Versión que los generó.
   *
   * @throws NotFoundError
   */
  clone(id: string, label?: string | null): Promise<ProjectVersion>;
  /** @throws NotFoundError */
  rename(id: string, label: string | null): Promise<ProjectVersion>;
  /**
   * @throws NotFoundError
   * @throws ConflictError si es la última Versión que le queda al Proyecto.
   */
  delete(id: string): Promise<void>;
}

export type NewTreeNode = {
  versionId: string;
  parentId?: string | null;
  content?: string;
  orderIndex?: number;
};

export type TreeNodePatch = {
  parentId?: string | null;
  content?: string;
  orderIndex?: number;
};

export interface NodeRepository {
  /** El árbol entero de una Versión, ya ordenado por padre y `orderIndex`. */
  listByVersion(versionId: string): Promise<TreeNode[]>;
  create(input: NewTreeNode): Promise<TreeNode>;
  /**
   * @throws NotFoundError
   * @throws ConflictError si el nuevo padre está en otra Versión.
   */
  update(id: string, patch: TreeNodePatch): Promise<TreeNode>;
  /** Se lleva el subárbol entero. @throws NotFoundError */
  delete(id: string): Promise<void>;
}

export type NewAnalysis = {
  versionId: string;
  userGuidelines?: string | null;
  provider: string;
  model: string;
  summary: string;
  questions?: string[];
  features?: AnalysisFeature[];
  masterPrompt: string;
  featurePrompts?: FeaturePrompt[];
};

export interface AnalysisRepository {
  /** Los Análisis de una Versión, del más nuevo al más viejo. */
  listByVersion(versionId: string): Promise<Analysis[]>;
  /** @throws NotFoundError */
  get(id: string): Promise<Analysis>;
  create(input: NewAnalysis): Promise<Analysis>;
  /** @throws NotFoundError */
  delete(id: string): Promise<void>;
}
