import { cookies } from "next/headers";

import { DashboardNav } from "@/components/layout/dashboard-nav";
import { ProjectsProvider } from "@/components/projects/projects-provider";
import { SIDEBAR_COOKIE, isSidebarCollapsed } from "@/lib/shell/sidebar";

/**
 * El marco de la aplicación autenticada.
 *
 * Es un COMPONENTE y no solo un `layout.tsx` a propósito. «Acerca de» es un
 * destino del shell, pero `/about` es pública y por tanto no puede vivir dentro
 * del grupo de rutas protegidas; si el shell fuera únicamente un layout, pulsar
 * «Acerca de» expulsaría al usuario del dashboard a la cabecera pública. Siendo
 * un componente lo montan los dos: `app/(dashboard)/layout.tsx` siempre, y
 * `app/about/page.tsx` solo cuando hay sesión.
 *
 * Lee la cookie de la sidebar en servidor para que el primer HTML ya traiga el
 * ancho correcto. Ver `lib/shell/sidebar.ts` sobre por qué es cookie y no
 * `localStorage`.
 *
 * Monta también el `ProjectsProvider`, y AQUÍ y no en la página porque los
 * accesos directos de la sidebar y la lista de la pantalla son los MISMOS
 * datos: cargados dos veces serían dos peticiones, dos verdades y una sidebar
 * que sigue enseñando el Proyecto que acabas de borrar.
 */
export async function AppShell({
  email,
  name = null,
  image = null,
  children,
}: {
  email: string;
  /** Nombre y foto del proveedor. `null` con email y contraseña. */
  name?: string | null;
  image?: string | null;
  children: React.ReactNode;
}) {
  const collapsed = isSidebarCollapsed(
    (await cookies()).get(SIDEBAR_COOKIE)?.value
  );

  return (
    <ProjectsProvider>
      <DashboardNav
        initialCollapsed={collapsed}
        email={email}
        name={name}
        image={image}
      >
        {children}
      </DashboardNav>
    </ProjectsProvider>
  );
}
