/**
 * Los tipos generados de Supabase encajan con `rows.ts`, o esto no compila.
 *
 * No exporta nada útil en runtime: es una aserción de tipos. Se importa desde
 * `index.ts` para que el typecheck la vea siempre.
 */

import type { Exact } from "@/lib/backend/adapters/postgrest/schema-contract";
import type {
  AnalysisRow,
  NodeRow,
  ProjectOverviewRow,
  ProjectRow,
  ProjectVersionRow,
} from "@/lib/backend/adapters/postgrest/rows";
import type { Tables, Views } from "@/lib/backend/adapters/supabase/database.types";

export const SUPABASE_SCHEMA_MATCHES_ROWS: [
  Exact<Tables<"projects">, ProjectRow>,
  Exact<Tables<"project_versions">, ProjectVersionRow>,
  Exact<Tables<"nodes">, NodeRow>,
  Exact<Tables<"ai_analyses">, AnalysisRow>,
  // La vista entra en la misma aserción que las tablas: es de donde sale la
  // lista, así que una columna que cambie ahí tiene que romper el typecheck
  // igual que si cambiara en `projects`.
  Exact<Views<"project_overviews">, ProjectOverviewRow>,
] = [true, true, true, true, true];
