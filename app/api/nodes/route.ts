/** El árbol de una Versión, y el alta de un Nodo. */

import { handleData, jsonBody, requiredParam } from "@/lib/backend/http/route";
import type { NewTreeNode } from "@/lib/backend/ports";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.nodes.listByVersion(requiredParam(request, "versionId")),
  );
}

export function POST(request: Request): Promise<Response> {
  return handleData(request, async (repositories) =>
    repositories.nodes.create(await jsonBody<NewTreeNode>(request)),
  );
}
