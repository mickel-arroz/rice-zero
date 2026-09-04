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
  AnalysisContent,
  Project,
  ProjectOverview,
  ProjectVersion,
  TreeNode,
} from "@/lib/backend/ports";
import {
  isJsonObject,
  type AnalysisRow,
  type NodeRow,
  type ProjectOverviewRow,
  type ProjectRow,
  type ProjectVersionRow,
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
    content: asAnalysisContent(r.analysis),
    createdAt: new Date(r.created_at),
  };
}

/**
 * La columna `jsonb` llega sin tipar, y aquí NO se valida su forma.
 *
 * Es un cast y es deliberado, por lo mismo que ya valía para las columnas
 * `jsonb` que había antes: la validación de verdad la hizo la capa de IA con
 * Zod ANTES de escribir (ADR 0003: un Análisis que no valida no se persiste),
 * así que repetirla aquí sería tener la misma regla en dos sitios. Y sobre
 * todo, un Análisis histórico puede llevar la forma de una versión anterior
 * del schema: tirarlo por no encajar con el contrato de hoy sería peor que
 * mostrarlo, y el ADR cuenta justamente con re-renderizar los viejos.
 *
 * Lo único que se comprueba es que haya un objeto (`isJsonObject`, compartido
 * con el doble en memoria). Un `null` o un número —que el motor acepta como
 * `jsonb` tan felizmente como un objeto, y que el `check` de la migración
 * `0003` ya rechaza— dejaría al renderer leyendo propiedades de nada, y eso no
 * es un Análisis viejo: es una fila imposible.
 */
function asAnalysisContent(value: unknown): AnalysisContent {
  return (isJsonObject(value) ? value : {}) as AnalysisContent;
}
