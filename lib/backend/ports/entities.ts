/**
 * Entidades de dominio del Proveedor de Backend.
 *
 * `camelCase` y `Date`, no `snake_case` ni strings ISO: son el vocabulario de
 * `CONTEXT.md`, no filas de una tabla. Ningún `database.types.ts` aparece
 * jamás en estas firmas — vive dentro de cada adaptador y ahí se queda.
 */

/** Contenedor raíz de una idea. Pertenece a un único usuario. */
export type Project = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Línea completa e independiente del árbol de un Proyecto.
 *
 * `versionNumber` es denso y monótono por Proyecto y lo asigna el motor: nunca
 * lo manda el cliente. `sourceVersionId` es de dónde se clonó ésta, y es solo
 * procedencia: no existe merge, nunca.
 */
export type ProjectVersion = {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string | null;
  sourceVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Unidad de idea en texto. Un padre (o raíz) y 0..n subnodos. Solo texto.
 *
 * `orderIndex` ordena entre hermanos. La posición en el Canvas no se guarda:
 * el layout es siempre automático.
 *
 * Se llama `TreeNode` y no `Node` porque `Node` es un global del DOM y el
 * puerto se importa desde código de navegador: la colisión sería silenciosa y
 * confusa. El criterio, para que sea uniforme: los TIPOS llevan el prefijo
 * (`TreeNode`, `NewTreeNode`, `TreeNodePatch`) y todo lo que nombra al dominio
 * usa el término de `CONTEXT.md` sin prefijo (`NodeRepository`,
 * `backend.nodes`).
 */
export type TreeNode = {
  id: string;
  versionId: string;
  parentId: string | null;
  content: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Una feature que la IA extrajo del árbol.
 *
 * La forma definitiva de esto y de `FeaturePrompt` la fija el Proveedor de IA
 * (#15). Aquí están porque el Análisis las persiste, y este es el archivo
 * donde cambian el día que se concreten.
 */
export type AnalysisFeature = {
  name: string;
  description: string;
};

/** Prompt acotado a una feature individual del mismo Análisis. */
export type FeaturePrompt = {
  name: string;
  prompt: string;
};

/**
 * Resultado de enviar una Versión a la IA. Histórico: se crea, se lee y se
 * borra, pero no se edita.
 */
export type Analysis = {
  id: string;
  versionId: string;
  /** Directrices del Usuario, guardadas tal cual para poder releer el Análisis. */
  userGuidelines: string | null;
  provider: string;
  model: string;
  summary: string;
  questions: string[];
  features: AnalysisFeature[];
  masterPrompt: string;
  featurePrompts: FeaturePrompt[];
  createdAt: Date;
};

/** El usuario autenticado, reducido a lo que la app necesita saber de él. */
export type AuthUser = {
  id: string;
  email: string;
  /** El spec exige verificación obligatoria: sin esto no se entra. */
  emailVerified: boolean;
};

/** Sesión activa. No expone el token: el adaptador lo inyecta él solo. */
export type AuthSession = {
  user: AuthUser;
};
