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
  created_at: string;
  updated_at: string;
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
  summary: string;
  questions: Json;
  features: Json;
  master_prompt: string;
  feature_prompts: Json;
  created_at: string;
};

export type TableName = "projects" | "project_versions" | "nodes" | "ai_analyses";
