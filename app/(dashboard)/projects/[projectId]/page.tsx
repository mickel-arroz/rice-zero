import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActiveVersionRedirect } from "@/components/versions/active-version-redirect";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { TREE_COPY, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: TREE_COPY.screenTitle,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Un Proyecto sin decir qué Versión: desvía a la más reciente.
 *
 * Esta ruta ya no pinta el árbol. Desde #14 la Versión vive en la URL —ver
 * `ROUTES.version`— y aquí solo queda la puerta por la que entran el acceso
 * directo de la sidebar y las tarjetas de la lista, que enlazan al Proyecto
 * porque no conocen el id de ninguna Versión suya.
 *
 * El desvío lo hace un componente de CLIENTE y no un `redirect()` de aquí:
 * `ServerBackendProvider` solo expone la sesión, así que desde el servidor no
 * hay a quién preguntarle cuál es la Versión activa. Ver
 * `ActiveVersionRedirect`.
 */
export default async function ProjectPage({
  params,
}: PageProps<"/projects/[projectId]">) {
  const session = await requestSession();

  // El layout ya comprobó la sesión, y aun así se comprueba otra vez: un layout
  // no se re-evalúa en cada navegación y por tanto no puede ser la puerta. Ver
  // el comentario de `app/(dashboard)/projects/page.tsx`.
  if (!canAct(session)) redirect(ROUTES.login);

  const { projectId } = await params;

  return <ActiveVersionRedirect projectId={projectId} />;
}
