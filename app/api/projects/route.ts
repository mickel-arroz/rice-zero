/**
 * Los Proyectos del usuario.
 *
 * Este archivo —y sus once hermanos— es lo único que traduce el contexto de un
 * Route Handler de Next a lo que el puerto entiende. Todo lo demás (sesión,
 * origen, la taxonomía de errores, las fechas por el cable) vive en
 * `lib/backend/http/route.ts`, que es compartido: doce copias de ese preámbulo
 * serían doce sitios donde olvidarse de comprobar la sesión.
 *
 * Ver `docs/adr/0006-los-datos-pasan-por-la-api-propia.md`.
 */

import { handleData, jsonBody } from "@/lib/backend/http/route";
import type { NewProject } from "@/lib/backend/ports";

/** La sesión sale de las cookies de la petición: nada de esto se puede cachear. */
export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return handleData(request, (repositories) => repositories.projects.list());
}

export function POST(request: Request): Promise<Response> {
  return handleData(request, async (repositories) =>
    repositories.projects.create(await jsonBody<NewProject>(request)),
  );
}
