/**
 * Los repositorios del puerto, hablando con la API de esta aplicación.
 *
 * Es el adaptador que el ADR 0006 pone en el navegador. No sabe qué proveedor
 * hay detrás y ésa es justo la gracia: desde aquí, cambiar de Neon a Supabase
 * no se nota, porque quien lo sabe es el servidor.
 *
 * Lo que NO hace, y conviene que siga sin hacer:
 *
 *   · No valida. Los límites de título, el catálogo de iconos y las reglas del
 *     árbol viven en `lib/services/` y en los `check` de las migraciones, que
 *     valen para todos los adaptadores. Una copia aquí sería una tercera.
 *   · No reintenta. `retryColdRead` corre ahora en el servidor, pegado al
 *     motor, que es donde el tropiezo del #41 ocurre y donde el reintento
 *     cuesta un viaje corto en vez de uno largo.
 *   · No cachea. Los cuatro providers de React ya sostienen el estado; una
 *     caché aquí sería una segunda fuente de verdad discutiendo con ellos.
 */

import { DATA_ROUTES, withQuery } from "@/lib/backend/http/mount";
import {
  NetworkError,
  type Analysis,
  type NewAnalysis,
  type NewProject,
  type NewProjectVersion,
  type NewTreeNode,
  type NodeSearchHit,
  type Project,
  type ProjectOverview,
  type ProjectPatch,
  type ProjectVersion,
  type Repositories,
  type TreeNode,
  type TreeNodePatch,
} from "@/lib/backend/ports";
import { decodeBackendError, decodeJson, encodeJson } from "@/lib/backend/wire";

/**
 * El `fetch` que se usa. Inyectable SOLO para poder correr la contract suite
 * contra los handlers de verdad sin levantar un servidor (ver
 * `lib/backend/testing/loopback.ts`). La app nunca le pasa nada.
 */
export type Fetch = typeof globalThis.fetch;

type Options = {
  readonly fetch?: Fetch;
};

/** Una petición y su respuesta, con toda la traducción de errores en un sitio. */
function createCall(doFetch: Fetch) {
  return async function call<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(path, {
        method: init?.method ?? "GET",
        // Las rutas se autorizan con la cookie de sesión, así que hay que
        // mandarla. `same-origin` y no `include`: estas rutas son nuestras y
        // nunca se llaman a otro sitio, y pedir `include` abriría la puerta a
        // mandar credenciales fuera el día que alguien pase una URL absoluta.
        credentials: "same-origin",
        headers: init?.body === undefined
          ? undefined
          : { "content-type": "application/json" },
        body: init?.body === undefined ? undefined : encodeJson(init.body),
      });
    } catch (cause) {
      // `fetch` solo rechaza cuando la petición no llegó a completarse: sin
      // red, DNS, CORS, abortada. Es literalmente `NetworkError`, que es lo
      // que enciende el bloqueo de edición offline.
      throw new NetworkError(undefined, { cause });
    }

    const text = await response.text();
    let envelope: unknown;
    try {
      envelope = decodeJson(text);
    } catch (cause) {
      // Cuerpo que no es JSON: una página de error de la plataforma, un
      // gateway que contesta texto, un 502 vacío. La petición no aterrizó
      // donde debía, así que se cuenta como fallo de red y no se inventa nada.
      throw new NetworkError(undefined, { cause });
    }

    if (
      typeof envelope === "object" &&
      envelope !== null &&
      "error" in envelope
    ) {
      throw decodeBackendError((envelope as { error: unknown }).error);
    }

    if (
      response.ok &&
      typeof envelope === "object" &&
      envelope !== null &&
      "value" in envelope
    ) {
      return (envelope as { value: T }).value;
    }

    // Un 200 con un sobre que no es ni `value` ni `error` es un contrato roto,
    // no un dato. Se trata como fallo de red por lo mismo que arriba.
    throw new NetworkError(undefined, { cause: envelope });
  };
}

export function createHttpRepositories(options: Options = {}): Repositories {
  const call = createCall(options.fetch ?? globalThis.fetch);

  return {
    projects: {
      list: () => call<Project[]>(DATA_ROUTES.projects),
      listOverviews: () =>
        call<ProjectOverview[]>(`${DATA_ROUTES.projects}/overviews`),
      get: (id) => call<Project>(`${DATA_ROUTES.projects}/${encodeURIComponent(id)}`),
      create: (input: NewProject) =>
        call<Project>(DATA_ROUTES.projects, { method: "POST", body: input }),
      update: (id, patch: ProjectPatch) =>
        call<Project>(`${DATA_ROUTES.projects}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: patch,
        }),
      delete: (id) =>
        call<void>(`${DATA_ROUTES.projects}/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },

    versions: {
      listByProject: (projectId) =>
        call<ProjectVersion[]>(withQuery(DATA_ROUTES.versions, { projectId })),
      get: (id) =>
        call<ProjectVersion>(`${DATA_ROUTES.versions}/${encodeURIComponent(id)}`),
      create: (input: NewProjectVersion) =>
        call<ProjectVersion>(DATA_ROUTES.versions, {
          method: "POST",
          body: input,
        }),
      clone: (id, label) =>
        call<ProjectVersion>(
          `${DATA_ROUTES.versions}/${encodeURIComponent(id)}/clone`,
          // `{ label }` y no `label` a secas: `undefined` significa «sin
          // etiqueta» y `null` también, pero un cuerpo que fuera literalmente
          // `null` no se distingue de un cuerpo ausente.
          { method: "POST", body: { label: label ?? null } },
        ),
      rename: (id, label) =>
        call<ProjectVersion>(`${DATA_ROUTES.versions}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { label },
        }),
      delete: (id) =>
        call<void>(`${DATA_ROUTES.versions}/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },

    nodes: {
      listByVersion: (versionId) =>
        call<TreeNode[]>(withQuery(DATA_ROUTES.nodes, { versionId })),
      countByVersion: (versionId) =>
        call<number>(withQuery(`${DATA_ROUTES.nodes}/count`, { versionId })),
      search: (query, limit) =>
        call<NodeSearchHit[]>(
          withQuery(`${DATA_ROUTES.nodes}/search`, { q: query, limit }),
        ),
      create: (input: NewTreeNode) =>
        call<TreeNode>(DATA_ROUTES.nodes, { method: "POST", body: input }),
      update: (id, patch: TreeNodePatch) =>
        call<TreeNode>(`${DATA_ROUTES.nodes}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: patch,
        }),
      delete: (id) =>
        call<void>(`${DATA_ROUTES.nodes}/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },

    analyses: {
      listByVersion: (versionId) =>
        call<Analysis[]>(withQuery(DATA_ROUTES.analyses, { versionId })),
      get: (id) =>
        call<Analysis>(`${DATA_ROUTES.analyses}/${encodeURIComponent(id)}`),
      create: (input: NewAnalysis) =>
        call<Analysis>(DATA_ROUTES.analyses, { method: "POST", body: input }),
      delete: (id) =>
        call<void>(`${DATA_ROUTES.analyses}/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }),
    },
  };
}
