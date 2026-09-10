/** Un Proyecto: leerlo, cambiarlo o borrarlo. */

import { handleData, jsonBody } from "@/lib/backend/http/route";
import type { ProjectPatch } from "@/lib/backend/ports";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/projects/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.projects.get(id));
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/projects/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, async (repositories) =>
    repositories.projects.update(id, await jsonBody<ProjectPatch>(request)),
  );
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/projects/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.projects.delete(id));
}
