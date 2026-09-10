/** Las Versiones de un Proyecto, y el alta de una nueva. */

import { handleData, jsonBody, requiredParam } from "@/lib/backend/http/route";
import type { NewProjectVersion } from "@/lib/backend/ports";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.versions.listByProject(requiredParam(request, "projectId")),
  );
}

export function POST(request: Request): Promise<Response> {
  return handleData(request, async (repositories) =>
    repositories.versions.create(await jsonBody<NewProjectVersion>(request)),
  );
}
