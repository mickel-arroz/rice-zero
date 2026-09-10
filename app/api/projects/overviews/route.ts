/**
 * Los Proyectos con sus cifras.
 *
 * Ruta propia y no un parámetro de `/api/projects` porque es otra consulta: el
 * puerto promete resolver los cuatro agregados por Proyecto en UNA sola, y
 * mezclarla con la lista simple detrás de un `?overview=1` escondería que son
 * dos caminos con costes distintos.
 *
 * El segmento es estático y convive con `[id]`: Next resuelve lo estático
 * primero, así que `/api/projects/overviews` nunca se lee como un id.
 */

import { handleData } from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.projects.listOverviews(),
  );
}
