/**
 * El núcleo compartido: los cuatro repositorios del puerto sobre un
 * `RowStore`.
 *
 * Aquí vive todo lo que no depende del proveedor: qué columnas se piden, cómo
 * se ordenan, qué parche se manda en un update, cuándo cero filas es
 * `NotFoundError` y cuándo una regla de `CONTEXT.md` es `ConflictError`.
 *
 * Que Neon y Supabase puedan compartirlo es una coincidencia de protocolo
 * (ambos son PostgREST), no una promesa del puerto: el ADR rechaza que el
 * protocolo llegue a los call sites, y de aquí no sale nada que no sea una
 * entidad de dominio.
 */

import {
  toAnalysis,
  toProject,
  toProjectVersion,
  toTreeNode,
} from "@/lib/backend/adapters/postgrest/mapping";
import type { Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import {
  ConflictError,
  NotFoundError,
  type Analysis,
  type AnalysisRepository,
  type NewAnalysis,
  type NewProject,
  type NewProjectVersion,
  type NewTreeNode,
  type NodeRepository,
  type Project,
  type ProjectPatch,
  type ProjectRepository,
  type ProjectVersion,
  type TreeNode,
  type TreeNodePatch,
  type VersionRepository,
} from "@/lib/backend/ports";

/**
 * Quita las claves ausentes de un parche.
 *
 * `undefined` significa «no lo toques» y `null` significa «ponlo a nulo»: si se
 * mandaran las dos igual, renombrar una Versión a nada y no renombrarla serían
 * la misma petición.
 */
function patchToRow(patch: Record<string, unknown>): Row {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
}

/** Una etiqueta vacía o en blanco es lo mismo que sin etiqueta. */
function normalizeLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

export function createProjectRepository(store: RowStore): ProjectRepository {
  return {
    async list(): Promise<Project[]> {
      const rows = await store.select("projects", {
        order: [{ column: "updated_at", ascending: false, nullsFirst: false }],
      });
      return rows.map(toProject);
    },

    async get(id): Promise<Project> {
      const rows = await store.select("projects", {
        where: [{ column: "id", value: id }],
      });
      const row = rows[0];
      if (!row) throw new NotFoundError("el Proyecto", id);
      return toProject(row);
    },

    async create(input: NewProject): Promise<Project> {
      // `owner_id` no se manda: lo pone el motor desde la sesión. Ver el
      // comentario de `repositories.ts` sobre por qué no está en el puerto.
      const row = await store.insert("projects", {
        title: input.title,
        description: input.description ?? null,
      });
      return toProject(row);
    },

    async update(id, patch: ProjectPatch): Promise<Project> {
      const row = await store.update("projects", id, patchToRow(patch));
      if (!row) throw new NotFoundError("el Proyecto", id);
      return toProject(row);
    },

    async delete(id): Promise<void> {
      if (!(await store.delete("projects", id))) {
        throw new NotFoundError("el Proyecto", id);
      }
    },
  };
}

export function createVersionRepository(store: RowStore): VersionRepository {
  async function get(id: string): Promise<ProjectVersion> {
    const rows = await store.select("project_versions", {
      where: [{ column: "id", value: id }],
    });
    const row = rows[0];
    if (!row) throw new NotFoundError("la Versión", id);
    return toProjectVersion(row);
  }

  return {
    async listByProject(projectId): Promise<ProjectVersion[]> {
      const rows = await store.select("project_versions", {
        where: [{ column: "project_id", value: projectId }],
        order: [{ column: "version_number", ascending: false, nullsFirst: false }],
      });
      return rows.map(toProjectVersion);
    },

    get,

    async create(input: NewProjectVersion): Promise<ProjectVersion> {
      // `version_number` no se manda: lo asigna un trigger, para que la
      // numeración sea densa y monótona por Proyecto.
      const row = await store.insert("project_versions", {
        project_id: input.projectId,
        label: normalizeLabel(input.label),
      });
      return toProjectVersion(row);
    },

    async clone(id, label): Promise<ProjectVersion> {
      const row = await store.cloneVersion(id, normalizeLabel(label));
      if (!row) throw new NotFoundError("la Versión", id);
      return toProjectVersion(row);
    },

    async rename(id, label): Promise<ProjectVersion> {
      const row = await store.update("project_versions", id, {
        label: normalizeLabel(label),
      });
      if (!row) throw new NotFoundError("la Versión", id);
      return toProjectVersion(row);
    },

    async delete(id): Promise<void> {
      // «Borrable salvo la última que quede» (CONTEXT.md). El motor no lo
      // impide: es una regla de producto, así que la aplica el puerto. La
      // carrera —dos borrados simultáneos que dejen el Proyecto sin Versiones—
      // es posible y aceptada: un Proyecto es de un solo usuario, y cerrarla
      // costaría una RPC más solo para esto.
      const version = await get(id);
      const siblings = await store.select("project_versions", {
        where: [{ column: "project_id", value: version.projectId }],
      });
      if (siblings.length <= 1) {
        throw new ConflictError(
          "ultima-version",
          "Un Proyecto no puede quedarse sin Versiones. Crea otra antes de borrar ésta.",
        );
      }
      if (!(await store.delete("project_versions", id))) {
        throw new NotFoundError("la Versión", id);
      }
    },
  };
}

export function createNodeRepository(store: RowStore): NodeRepository {
  return {
    async listByVersion(versionId): Promise<TreeNode[]> {
      const rows = await store.select("nodes", {
        where: [{ column: "version_id", value: versionId }],
        // Raíces primero y hermanos en orden: así el árbol llega listo para
        // construirse en una pasada, sin tener que esperar a un padre que
        // todavía no ha llegado.
        order: [
          { column: "parent_id", ascending: true, nullsFirst: true },
          { column: "order_index", ascending: true, nullsFirst: false },
        ],
      });
      return rows.map(toTreeNode);
    },

    async create(input: NewTreeNode): Promise<TreeNode> {
      const row = await store.insert("nodes", {
        version_id: input.versionId,
        parent_id: input.parentId ?? null,
        content: input.content ?? "",
        order_index: input.orderIndex ?? 0,
      });
      return toTreeNode(row);
    },

    async update(id, patch: TreeNodePatch): Promise<TreeNode> {
      const row = await store.update(
        "nodes",
        id,
        patchToRow({
          parent_id: patch.parentId,
          content: patch.content,
          order_index: patch.orderIndex,
        }),
      );
      if (!row) throw new NotFoundError("el Nodo", id);
      return toTreeNode(row);
    },

    async delete(id): Promise<void> {
      if (!(await store.delete("nodes", id))) {
        throw new NotFoundError("el Nodo", id);
      }
    },
  };
}

export function createAnalysisRepository(store: RowStore): AnalysisRepository {
  return {
    async listByVersion(versionId): Promise<Analysis[]> {
      const rows = await store.select("ai_analyses", {
        where: [{ column: "version_id", value: versionId }],
        order: [{ column: "created_at", ascending: false, nullsFirst: false }],
      });
      return rows.map(toAnalysis);
    },

    async get(id): Promise<Analysis> {
      const rows = await store.select("ai_analyses", {
        where: [{ column: "id", value: id }],
      });
      const row = rows[0];
      if (!row) throw new NotFoundError("el Análisis", id);
      return toAnalysis(row);
    },

    async create(input: NewAnalysis): Promise<Analysis> {
      const row = await store.insert("ai_analyses", {
        version_id: input.versionId,
        user_guidelines: input.userGuidelines ?? null,
        provider: input.provider,
        model: input.model,
        summary: input.summary,
        questions: input.questions ?? [],
        features: input.features ?? [],
        master_prompt: input.masterPrompt,
        feature_prompts: input.featurePrompts ?? [],
      });
      return toAnalysis(row);
    },

    async delete(id): Promise<void> {
      if (!(await store.delete("ai_analyses", id))) {
        throw new NotFoundError("el Análisis", id);
      }
    },
  };
}

/** Los cuatro repositorios sobre el mismo almacén. */
export function createRepositories(store: RowStore) {
  return {
    projects: createProjectRepository(store),
    versions: createVersionRepository(store),
    nodes: createNodeRepository(store),
    analyses: createAnalysisRepository(store),
  };
}
