/**
 * Entidades de dominio del Proveedor de Backend.
 *
 * `camelCase` y `Date`, no `snake_case` ni strings ISO: son el vocabulario de
 * `CONTEXT.md`, no filas de una tabla. Ningún `database.types.ts` aparece
 * jamás en estas firmas — vive dentro de cada adaptador y ahí se queda.
 */

/**
 * La forma del Análisis, tal y como la fija la capa de IA.
 *
 * Se llama `AnalysisContent` y no `Analysis` porque en este archivo `Analysis`
 * es la ENTIDAD —con su id, su Versión y su fecha— y esto es su contenido. El
 * alias no se inventa aquí: lo declara `lib/ai/schema.ts`, que es la fuente de
 * verdad de la forma, para que no haya dos nombres para lo mismo.
 *
 * Y se reexporta, para que quien lea un Análisis del puerto pueda nombrar su
 * contenido sin tener que saber que viene de `lib/ai`. Es un tipo, así que el
 * import se borra al compilar: no hay dependencia en tiempo de ejecución.
 */
import type { AnalysisContent } from "@/lib/ai/schema";

export type { AnalysisContent };

/** Contenedor raíz de una idea. Pertenece a un único usuario. */
export type Project = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  /**
   * Clave del icono asignado, del catálogo de `components/icons/projects`.
   *
   * `string` y no la unión de las 30 claves a propósito, y en las dos
   * direcciones. Al LEER, porque la fila puede traer una clave que escribió una
   * versión anterior de la app o una mano, y estrechar el tipo aquí solo
   * trasladaría la mentira al llamante — quien la resuelve es `projectIconFor`,
   * que cae al icono por defecto. Al ESCRIBIR, porque el catálogo es de la
   * interfaz y el puerto no puede importarlo sin invertir el límite del ADR
   * 0001: quien valida contra él es la capa de servicios.
   */
  icon: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Un Proyecto con las cifras que lo describen de un vistazo.
 *
 * Existe porque la pantalla de Proyectos las necesita TODAS a la vez, y pedir
 * cada cifra por Proyecto sería N+1 sobre la lista. Es la forma de la lista, no
 * una entidad nueva: por eso extiende `Project` en vez de envolverlo.
 */
export type ProjectOverview = Project & {
  versionCount: number;
  /** Nodos de TODAS las Versiones del Proyecto: el tamaño de la idea. */
  nodeCount: number;
  analysisCount: number;
  /**
   * Lo más reciente que le ha pasado al Proyecto, mirando también sus Versiones
   * y sus Nodos.
   *
   * No es `updatedAt`. `updatedAt` solo se mueve cuando cambia la fila del
   * Proyecto, y editar un Nodo no la toca — así que ordenar por ella dejaría la
   * lista congelada mientras el usuario trabaja.
   */
  lastActivityAt: Date;
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
 * Resultado de enviar una Versión a la IA. Histórico: se crea, se lee y se
 * borra, pero no se edita.
 *
 * Lo que se guarda es el OBJETO que devolvió la IA, no su texto (ADR 0003). El
 * Master Prompt se rendera al leerlo (`lib/ai/render.ts`), así que cambiar el
 * formato de salida es un cambio de renderer y no una migración.
 */
export type Analysis = {
  id: string;
  versionId: string;
  /** Directrices del Usuario, guardadas tal cual para poder releer el Análisis. */
  userGuidelines: string | null;
  provider: string;
  model: string;
  /**
   * El Análisis en sí: Intención, resumen, preguntas, Spec y Tickets.
   *
   * Su tipo lo importa de `lib/ai/schema.ts` en vez de redeclararlo, y esa es
   * la única dirección posible: el schema de Zod es la fuente de verdad de esta
   * forma, y un `type` paralelo aquí se desincronizaría a la primera sin que
   * el compilador se enterara — es literalmente lo que ese archivo advierte de
   * sí mismo. Sigue siendo vocabulario de dominio y no de tabla, que es lo que
   * el ADR 0001 le pide a este archivo.
   *
   * Al ESCRIBIR el tipo es una promesa cumplida: nada llega aquí sin pasar por
   * el `.parse` del adaptador de IA. Al LEER es un cast, deliberadamente: una
   * fila vieja puede traer la forma de una versión anterior del schema, y
   * tirar un Análisis histórico por no encajar con el contrato de hoy sería
   * peor que mostrarlo. Ver `postgrest/mapping.ts`.
   */
  content: AnalysisContent;
  createdAt: Date;
};

/** El usuario autenticado, reducido a lo que la app necesita saber de él. */
export type AuthUser = {
  id: string;
  email: string;
  /** El spec exige verificación obligatoria: sin esto no se entra. */
  emailVerified: boolean;
  /**
   * Nombre y foto tal cual los da el proveedor, o `null`.
   *
   * Son opcionales de verdad y no un descuido: quien entra con email y
   * contraseña no tiene ninguno de los dos, así que toda la interfaz que los
   * use tiene que saber pintarse sin ellos. Ver `components/ui/avatar.tsx`.
   */
  name: string | null;
  image: string | null;
};

/** Sesión activa. No expone el token: el adaptador lo inyecta él solo. */
export type AuthSession = {
  user: AuthUser;
};
