import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProjectsScreen } from "@/components/projects/projects-screen";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { PROJECTS_COPY, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: PROJECTS_COPY.title,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * La ruta protegida.
 *
 * El armazón —sidebar, cabecera móvil y menú— lo pone
 * `app/(dashboard)/layout.tsx`, y la lista la pinta `ProjectsScreen`, que es de
 * cliente. Aquí no se leen Proyectos y no es un olvido: el ADR 0001 decide que
 * el navegador habla DIRECTO con PostgREST y que la autorización se queda en
 * RLS, así que no hay camino de datos en el servidor por el que precargarlos.
 * Esta página es solo la puerta.
 */
export default async function ProjectsPage() {
  const session = await requestSession();

  // El layout ya comprobó la sesión, y aun así se comprueba otra vez: es lo que
  // la documentación de Next pide, porque un layout no se re-evalúa en cada
  // navegación y por tanto no puede ser la puerta. La comprobación de verdad
  // vive en la página.
  //
  // `canAct` y no `session !== null`: una cuenta sin el email confirmado tiene
  // sesión pero no puede actuar, y el spec exige la confirmación.
  if (!canAct(session)) redirect(ROUTES.login);

  return <ProjectsScreen />;
}
