/** Los Análisis de una Versión, y el alta de uno nuevo. */

import { handleData, jsonBody, requiredParam } from "@/lib/backend/http/route";
import type { NewAnalysis } from "@/lib/backend/ports";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) =>
    repositories.analyses.listByVersion(requiredParam(request, "versionId")),
  );
}

export function POST(request: Request): Promise<Response> {
  return handleData(request, async (repositories) =>
    repositories.analyses.create(await jsonBody<NewAnalysis>(request)),
  );
}
