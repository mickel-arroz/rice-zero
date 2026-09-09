import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AnalysisScreen } from "@/components/analysis/analysis-screen";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { ANALYSIS_COPY, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: ANALYSIS_COPY.label,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * Cuánto se le deja al servidor antes de que la plataforma corte. En segundos.
 *
 * Repetido aquí y no heredado del layout a propósito: `maxDuration` es de la
 * PÁGINA, y un Server Action se compila a un POST contra la ruta que lo invoca.
 * Desde #52 quien invoca `generateAnalysis` es esta pantalla, así que sin este
 * número la generación se cortaría por fuera —como un fallo del framework, no
 * como el `AnalysisTimeoutError` que la pantalla sabe explicar—.
 *
 * El mismo 150 que la página del árbol, y por el mismo motivo: el presupuesto
 * de la cadena de modelos son dos minutos, y el margen es para que el corte lo
 * dé siempre nuestro código.
 */
export const maxDuration = 150;

/**
 * El Análisis de una Versión, en su propia pantalla.
 *
 * Anidada bajo la Versión y no colgando del Proyecto: un Análisis pertenece a
 * UNA Versión —es lo que la define en el glosario— y que eso se vea en la
 * dirección es lo que hace que la vuelta sea navegación hacia arriba y no un
 * «atrás» del navegador.
 *
 * Los providers los monta `layout.tsx`, así que llegar aquí no desmonta el
 * árbol ni cancela una generación en vuelo.
 */
export default async function AnalysisPage({
  params,
}: PageProps<"/projects/[projectId]/[versionId]/analisis">) {
  const session = await requestSession();

  // La puerta va en la página y no en el layout: un layout no se re-evalúa en
  // cada navegación, así que no puede serlo.
  if (!canAct(session)) redirect(ROUTES.login);

  const { projectId, versionId } = await params;

  return <AnalysisScreen projectId={projectId} versionId={versionId} />;
}
