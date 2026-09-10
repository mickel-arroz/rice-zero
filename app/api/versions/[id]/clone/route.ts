/**
 * Clonar una Versión.
 *
 * Subrecurso y no un verbo en la query porque es una escritura que crea otra
 * entidad: `POST /api/versions/<id>/clone` se lee como lo que hace, y no se
 * puede repetir por accidente desde la barra de direcciones.
 */

import { handleData, jsonBody } from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/versions/[id]/clone">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, async (repositories) => {
    const { label } = await jsonBody<{ label: string | null }>(request);
    return repositories.versions.clone(id, label ?? null);
  });
}
