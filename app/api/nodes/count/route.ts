/**
 * Cuántos Nodos tiene una Versión.
 *
 * Ruta propia y no `?count=1` sobre el árbol por la misma razón por la que está
 * en el puerto: lo que la hace valer la pena es lo que NO hace. Abajo sale como
 * un HEAD y el motor devuelve la cifra en una cabecera, sin mandar una sola
 * fila. Mezclarla con la lectura del árbol invitaría a resolverla contando un
 * array, que es traerse el árbol entero por el cable para enseñar un número.
 */

import { handleData, requiredParam } from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.nodes.countByVersion(requiredParam(request, "versionId")),
  );
}
