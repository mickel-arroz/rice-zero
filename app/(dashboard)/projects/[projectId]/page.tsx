import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TreeProvider } from "@/components/tree/tree-provider";
import { TreeScreen } from "@/components/tree/tree-screen";
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
 * La pantalla de un Proyecto: el árbol de su Versión activa, en cualquiera de
 * las dos vistas.
 *
 * La Versión NO va en la URL, y es deliberado mientras no exista el selector
 * (#14): abrir un Proyecto tiene que llevar a un sitio y siempre al mismo, y
 * ese sitio es la Versión más reciente. Cuando la Versión sea elegible, esta
 * ruta pasará a redirigir a la suya y el trabajo será cambiar un `href`.
 *
 * Aquí no se leen Nodos, igual que en `/projects`: el ADR 0001 decide que el
 * navegador habla DIRECTO con PostgREST y que la autorización se queda en RLS,
 * así que no hay camino de datos en el servidor por el que precargarlos. Esta
 * página es solo la puerta.
 */
export default async function ProjectPage({ params }: PageProps<"/projects/[projectId]">) {
  const session = await requestSession();

  // El layout ya comprobó la sesión, y aun así se comprueba otra vez: un layout
  // no se re-evalúa en cada navegación y por tanto no puede ser la puerta. Ver
  // el comentario de `app/(dashboard)/projects/page.tsx`.
  if (!canAct(session)) redirect(ROUTES.login);

  const { projectId } = await params;

  return (
    <TreeProvider projectId={projectId}>
      <TreeScreen projectId={projectId} />
    </TreeProvider>
  );
}
