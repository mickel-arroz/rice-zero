/**
 * Una Versión: leerla, renombrarla o borrarla.
 *
 * `rename` va por PATCH y `clone` por POST a un subrecurso, y no los dos por el
 * mismo verbo: renombrar cambia esta Versión, clonar CREA otra. Un PATCH que a
 * veces devolviera una entidad distinta de la que se pidió sería mentira.
 */

import { handleData, jsonBody } from "@/lib/backend/http/route";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/versions/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.versions.get(id));
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/versions/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, async (repositories) => {
    // `label` puede ser `null` a propósito: es como se le quita la etiqueta a
    // una Versión, que pasa a llamarse por su número.
    const { label } = await jsonBody<{ label: string | null }>(request);
    return repositories.versions.rename(id, label ?? null);
  });
}

export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/versions/[id]">,
): Promise<Response> {
  const { id } = await params;
  return handleData(request, (repositories) => repositories.versions.delete(id));
}
