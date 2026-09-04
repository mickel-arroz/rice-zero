/**
 * La forma de las filas, tal y como las crea `db/migrations/`.
 *
 * Estos tipos NO son el puerto: el puerto habla de entidades de dominio. Son
 * el contrato entre el núcleo compartido y el `database.types.ts` de cada
 * adaptador, que es generado y por tanto puede derivar. Cada adaptador afirma
 * ese encaje en su `schema-check.ts`, y si el esquema cambia sin actualizar los
 * tipos, el typecheck se rompe ahí y no en producción.
 *
 * `snake_case` y strings ISO porque es lo que devuelve el motor. La traducción
 * a dominio vive en `mapping.ts`.
 */

/**
 * Lo que cabe en una columna `jsonb`. Se declara aquí, con la misma forma que
 * el `Json` de los archivos generados, para que el contrato no dependa de
 * importar nada de un adaptador.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  icon: string;
  created_at: string;
  updated_at: string;
};

/**
 * La fila de `project_overviews`, la vista que resuelve la lista y sus cuatro
 * cifras de una vez.
 *
 * Los contadores llegan como `int` y no como el `bigint` que devuelve
 * `count(*)`: la vista los castea, porque PostgREST serializa un `bigint` como
 * cadena y `24` habría llegado a la interfaz siendo `"24"`.
 */
export type ProjectOverviewRow = ProjectRow & {
  version_count: number;
  node_count: number;
  analysis_count: number;
  last_activity_at: string;
};

export type ProjectVersionRow = {
  id: string;
  project_id: string;
  version_number: number;
  label: string | null;
  source_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NodeRow = {
  id: string;
  version_id: string;
  parent_id: string | null;
  content: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type AnalysisRow = {
  id: string;
  version_id: string;
  user_guidelines: string | null;
  provider: string;
  model: string;
  /**
   * El Análisis entero, como `jsonb`. Ver la migración `0003`.
   *
   * `Json` y no el tipo del schema de la IA: aquí se habla el lenguaje del
   * motor, y el motor solo promete «JSON válido». Quien le pone forma es
   * `mapping.ts`, que es la frontera.
   */
  analysis: Json;
  created_at: string;
};

/**
 * ¿Es este `jsonb` un objeto?
 *
 * Un `jsonb` acepta `null`, un número y un array tan felizmente como un objeto,
 * y cualquiera de los tres dentro de `ai_analyses.analysis` es un Análisis que
 * el renderer no sabe pintar. La autoridad es el `check` de la migración
 * `0003`; esto es la misma pregunta dicha en TypeScript, y vive aquí —junto a
 * `Json`— porque la hacen dos sitios: el mapeo al LEER y el doble en memoria al
 * escribir. Dos copias de la expresión de tres cláusulas se desincronizarían en
 * cuanto alguien recordara el array en una y no en la otra.
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type TableName = "projects" | "project_versions" | "nodes" | "ai_analyses";

/**
 * Lo que se puede LEER pero no escribir.
 *
 * Aparte de `TableName` y no dentro para que el tipo diga la verdad: `insert`,
 * `update` y `delete` solo aceptan tablas, así que nadie puede intentar
 * escribir en una vista ni por error. Es la misma distinción que hace el
 * `grant` de la migración, dicha en TypeScript.
 */
export type ViewName = "project_overviews";

/** Cualquier cosa de la que se pueda leer. */
export type SourceName = TableName | ViewName;

/**
 * Cómo se llama cada tabla en el vocabulario de `CONTEXT.md`.
 *
 * Vive aquí, pegado a `TableName`, porque es lo único que traduce entre los dos
 * lados de este archivo: los nombres del motor y los del dominio. Lo usan el
 * núcleo (para construir `NotFoundError`) y los stores (para traducir un fallo
 * del motor), y tenerlo una sola vez es lo que hace que renombrar un término
 * canónico sea un cambio de una línea.
 */
export const RESOURCE: Record<SourceName, string> = {
  projects: "el Proyecto",
  // La vista habla de lo mismo que la tabla, así que un fallo leyéndola tiene
  // que sonar igual: al usuario no le importa por dónde se pidió.
  project_overviews: "el Proyecto",
  project_versions: "la Versión",
  nodes: "el Nodo",
  ai_analyses: "el Análisis",
};
