/**
 * El enrutador que Next pone en producción, aquí escrito a mano.
 *
 * Casa método y ruta con el Route Handler que le toca, y le entrega los
 * `params` que Next le entregaría. Es la única parte de `loopback.ts` que
 * DUPLICA algo —el mapa de rutas a archivos— y no hay forma de evitarlo: en
 * Next ese mapa es la estructura de carpetas, y una estructura de carpetas no
 * se puede importar.
 *
 * Lo que sí se evita es que la duplicación mienta en silencio: los handlers se
 * importan de verdad, así que renombrar una carpeta rompe este archivo en el
 * typecheck, y una ruta que aquí no esté hace fallar su método en la contract
 * suite con un 404 que nadie puede confundir con otra cosa.
 */

import * as analyses from "@/app/api/analyses/route";
import * as analysis from "@/app/api/analyses/[id]/route";
import * as nodes from "@/app/api/nodes/route";
import * as node from "@/app/api/nodes/[id]/route";
import * as nodeCount from "@/app/api/nodes/count/route";
import * as nodeSearch from "@/app/api/nodes/search/route";
import * as projects from "@/app/api/projects/route";
import * as project from "@/app/api/projects/[id]/route";
import * as overviews from "@/app/api/projects/overviews/route";
import * as versions from "@/app/api/versions/route";
import * as version from "@/app/api/versions/[id]/route";
import * as versionClone from "@/app/api/versions/[id]/clone/route";

type Handler = (request: Request) => Promise<Response> | Response;

/** Un handler con `[id]`, envuelto para que reciba los `params` de Next. */
function withId(
  handler: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>,
  id: string,
): Handler {
  return (request) => handler(request, { params: Promise.resolve({ id }) });
}

function notFound(): Response {
  return Response.json(
    { error: { kind: "unknown", message: "Esa ruta no existe en el loopback." } },
    { status: 404 },
  );
}

/**
 * Resuelve una ruta contra los handlers reales.
 *
 * El orden de las ramas reproduce el de Next: primero el segmento estático
 * (`overviews`, `count`, `search`) y solo después el dinámico. Si alguna vez
 * dejaran de coincidir, la contract suite lo diría.
 */
export function routeLoopback(request: Request): Promise<Response> | Response {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  const [, , resource, first, second] = pathname.split("/");

  const dispatch = (module: Record<string, unknown>): Handler | null =>
    typeof module[method] === "function" ? (module[method] as Handler) : null;

  const dispatchWithId = (
    module: Record<string, unknown>,
    id: string,
  ): Handler | null =>
    typeof module[method] === "function"
      ? withId(module[method] as Parameters<typeof withId>[0], id)
      : null;

  let handler: Handler | null = null;

  if (resource === "projects") {
    if (!first) handler = dispatch(projects);
    else if (first === "overviews") handler = dispatch(overviews);
    else handler = dispatchWithId(project, decodeURIComponent(first));
  } else if (resource === "versions") {
    if (!first) handler = dispatch(versions);
    else if (second === "clone")
      handler = dispatchWithId(versionClone, decodeURIComponent(first));
    else handler = dispatchWithId(version, decodeURIComponent(first));
  } else if (resource === "nodes") {
    if (!first) handler = dispatch(nodes);
    else if (first === "count") handler = dispatch(nodeCount);
    else if (first === "search") handler = dispatch(nodeSearch);
    else handler = dispatchWithId(node, decodeURIComponent(first));
  } else if (resource === "analyses") {
    if (!first) handler = dispatch(analyses);
    else handler = dispatchWithId(analysis, decodeURIComponent(first));
  }

  return handler ? handler(request) : notFound();
}
