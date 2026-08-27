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
  ProjectRow,
  ProjectVersionRow,
} from "@/lib/backend/adapters/postgrest/rows";
import type { Tables } from "@/lib/backend/adapters/supabase/database.types";

export const SUPABASE_SCHEMA_MATCHES_ROWS: [
  Exact<Tables<"projects">, ProjectRow>,
  Exact<Tables<"project_versions">, ProjectVersionRow>,
  Exact<Tables<"nodes">, NodeRow>,
  Exact<Tables<"ai_analyses">, AnalysisRow>,
] = [true, true, true, true];
