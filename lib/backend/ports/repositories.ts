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
  ProjectVersion,
  TreeNode,
} from "@/lib/backend/ports/entities";

export type NewProject = {
  title: string;
  description?: string | null;
};

export type ProjectPatch = {
  title?: string;
  description?: string | null;
};

export interface ProjectRepository {
  /** Los Proyectos del usuario, del más recientemente tocado al más viejo. */
  list(): Promise<Project[]>;
  /** @throws NotFoundError si no existe o no es tuyo. */
  get(id: string): Promise<Project>;
  create(input: NewProject): Promise<Project>;
  /** @throws NotFoundError */
  update(id: string, patch: ProjectPatch): Promise<Project>;
  /** @throws NotFoundError */
  delete(id: string): Promise<void>;
}

export type NewProjectVersion = {
  projectId: string;
  label?: string | null;
};

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
