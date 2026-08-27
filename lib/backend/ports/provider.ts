/**
 * El Proveedor de Backend: persistencia y autenticación tras una sola
 * interfaz, para que cambiar de proveedor sea cambiar una variable.
 */

import type { AuthProvider } from "@/lib/backend/ports/auth";
import type {
  AnalysisRepository,
  NodeRepository,
  ProjectRepository,
  VersionRepository,
} from "@/lib/backend/ports/repositories";

export type BackendProvider = {
  /** Cómo se llama este adaptador. Solo para diagnóstico y mensajes. */
  readonly name: string;
  readonly auth: AuthProvider;
  readonly projects: ProjectRepository;
  readonly versions: VersionRepository;
  readonly nodes: NodeRepository;
  readonly analyses: AnalysisRepository;
};
