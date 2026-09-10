/**
 * Un Nodo: cambiarlo o borrarlo.
 *
 * No hay GET, y no es un olvido: un Nodo suelto no se lee nunca. La interfaz
 * pide siempre el árbol de su Versión, porque un Nodo sin sus hermanos no se
 * puede ni pintar ni ordenar. Una ruta que nadie llama es una puerta más que
 * mantener cerrada.
 */

import { handleData, jsonBody } from "@/lib/backend/http/route";
import type { TreeNodePatch } from "@/lib/backend/ports";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/nodes/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, async (repositories) =>
    repositories.nodes.update(id, await jsonBody<TreeNodePatch>(request)),
  );
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/nodes/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.nodes.delete(id));
}
