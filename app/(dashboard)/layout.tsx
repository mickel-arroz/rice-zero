import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { ROUTES } from "@/lib/constants";

/**
 * El marco de todas las pantallas autenticadas.
 *
 * `(dashboard)` es un Route Group: agrupa rutas bajo un layout SIN añadir
 * segmento a la URL, así que `/projects` sigue siendo `/projects`. Es lo que
 * hace que el shell sobreviva a las navegaciones dentro del dashboard — un
 * layout no se vuelve a montar al cambiar de ruta, así que la sidebar conserva
 * su scroll y su estado.
 *
 * La sesión se lee aquí SOLO para tener el email que pinta la sidebar. Quien
 * decide si la página se renderiza sigue siendo cada página: un layout no se
 * re-evalúa en cada navegación, así que no puede ser la puerta. Ver el
 * comentario de `lib/auth/session.ts`.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/">) {
  const session = await requestSession();
  if (!canAct(session)) redirect(ROUTES.login);

  return (
    <AppShell
      email={session.user.email}
      name={session.user.name}
      image={session.user.image}
    >
      {children}
    </AppShell>
  );
}
