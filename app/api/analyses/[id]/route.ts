/**
 * Un Análisis: leerlo o borrarlo.
 *
 * No hay PATCH porque un Análisis no se edita: es histórico, se crea, se lee y
 * se borra. La tabla ni siquiera concede UPDATE al rol autenticado.
 */

import { handleData } from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/analyses/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.analyses.get(id));
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/analyses/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.analyses.delete(id));
}
