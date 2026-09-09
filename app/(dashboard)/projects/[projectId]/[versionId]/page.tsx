import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TreeScreen } from "@/components/tree/tree-screen";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { TREE_COPY, ROUTES } from "@/lib/constants";
import { TREE_VIEW_COOKIE, treeViewFor } from "@/lib/shell/tree-view";

export const metadata: Metadata = {
  title: TREE_COPY.screenTitle,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Cuánto se le deja al servidor antes de que la plataforma corte. En segundos.
 *
 * Está aquí y no en la capa de IA porque un Server Action se compila a un POST
 * contra la RUTA que lo invoca: `generateAnalysis` corre bajo esta página, así
 * que este número es el suyo. `AI_CONFIG` ya lo avisaba —«la ruta que monte el
 * panel tiene que declarar un `maxDuration` por encima»— y sin esto el aviso se
 * habría quedado en un comentario.
 *
 * 150 y no 120: el presupuesto de la cadena de modelos son dos minutos, y si el
 * corte de la plataforma cayera en el mismo sitio ganaría el suyo — que llega
 * como un fallo del framework y no como el `AnalysisTimeoutError` que el panel
 * sabe explicar. El margen es para que el corte lo dé siempre nuestro código.
 *
 * ⚠ Un plan que no llegue a este número no puede servir esta app tal cual: la
 * generación se cortaría por fuera antes de que la cadena termine.
 */
export const maxDuration = 150;

/**
 * El árbol de UNA Versión, en cualquiera de las dos vistas.
 *
 * La Versión va en la URL (#14) y eso es lo que hace que recargar, el botón de
 * atrás y un enlace pegado a alguien devuelvan la Versión que se estaba
 * mirando. `/projects/[projectId]` sigue existiendo como desvío a la activa.
 *
 * Los providers ya no están aquí: desde #52 viven en `layout.tsx`, para que ir
 * al Análisis —que es otra página bajo esta misma Versión— no los desmonte. Lo
 * que sí sigue aquí es la puerta de la sesión, porque un layout no se
 * re-evalúa en cada navegación y por tanto no puede serlo.
 *
 * Y lo que resuelve el servidor: CON QUÉ VISTA se abre. Sale de una cookie, y
 * leerla aquí es lo que evita que la pantalla salga en Registro y salte al
 * Canvas al hidratar. Ver `lib/shell/tree-view.ts`.
 */
export default async function VersionPage({
  params,
}: PageProps<"/projects/[projectId]/[versionId]">) {
  const session = await requestSession();

  // La puerta está AQUÍ y no en el layout: un layout no se re-evalúa en cada
  // navegación, así que no puede serlo. Ver `layout.tsx`, que lo dice también
  // desde el otro lado.
  if (!canAct(session)) redirect(ROUTES.login);

  const { projectId } = await params;
  const view = treeViewFor(
    (await cookies()).get(TREE_VIEW_COOKIE)?.value,
    projectId,
  );

  return <TreeScreen projectId={projectId} initialView={view} />;
}
