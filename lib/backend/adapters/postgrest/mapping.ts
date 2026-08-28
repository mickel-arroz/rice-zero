/**
 * Fila → entidad de dominio.
 *
 * Es el único sitio donde `snake_case` y los strings ISO del motor se
 * convierten en el vocabulario de `CONTEXT.md`. Al revés (entidad → fila) no
 * hay función: las escrituras mandan parches parciales y los construye cada
 * repositorio.
 */

import type {
  Analysis,
  AnalysisFeature,
  FeaturePrompt,
  Project,
  ProjectOverview,
  ProjectVersion,
  TreeNode,
} from "@/lib/backend/ports";
import type {
  AnalysisRow,
  NodeRow,
  ProjectOverviewRow,
  ProjectRow,
  ProjectVersionRow,
} from "@/lib/backend/adapters/postgrest/rows";
import type { Row } from "@/lib/backend/adapters/postgrest/store";

export function toProject(row: Row): Project {
  const r = row as unknown as ProjectRow;
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description,
    icon: r.icon,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

/**
 * La fila de la vista trae las mismas columnas del Proyecto más las cuatro
 * cifras, así que se reutiliza `toProject` en vez de repetirlas: el día que el
 * Proyecto gane un campo, la lista lo gana sola.
 */
export function toProjectOverview(row: Row): ProjectOverview {
  const r = row as unknown as ProjectOverviewRow;
  return {
    ...toProject(row),
    versionCount: r.version_count,
    nodeCount: r.node_count,
    analysisCount: r.analysis_count,
    lastActivityAt: new Date(r.last_activity_at),
  };
}

export function toProjectVersion(row: Row): ProjectVersion {
  const r = row as unknown as ProjectVersionRow;
  return {
    id: r.id,
    projectId: r.project_id,
    versionNumber: r.version_number,
    label: r.label,
    sourceVersionId: r.source_version_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export function toTreeNode(row: Row): TreeNode {
  const r = row as unknown as NodeRow;
  return {
    id: r.id,
    versionId: r.version_id,
    parentId: r.parent_id,
    content: r.content,
    orderIndex: r.order_index,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export function toAnalysis(row: Row): Analysis {
  const r = row as unknown as AnalysisRow;
  return {
    id: r.id,
    versionId: r.version_id,
    userGuidelines: r.user_guidelines,
    provider: r.provider,
    model: r.model,
    summary: r.summary,
    questions: asStringArray(r.questions),
    features: asObjectArray<AnalysisFeature>(r.features),
    masterPrompt: r.master_prompt,
    featurePrompts: asObjectArray<FeaturePrompt>(r.feature_prompts),
    createdAt: new Date(r.created_at),
  };
}

/**
 * Las columnas `jsonb` llegan sin tipar y su forma la fija el Proveedor de IA,
 * no el motor. Se comprueba que sea un array y se deja pasar el contenido: una
 * validación de forma aquí duplicaría la que hace la capa de IA al generarlo, y
 * tirar un Análisis histórico por no encajar con el esquema de hoy sería peor
 * que mostrarlo.
 */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
