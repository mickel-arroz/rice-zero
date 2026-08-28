import { cookies } from "next/headers";

import {
  DashboardNav,
  type ProjectShortcut,
} from "@/components/layout/dashboard-nav";
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
 */
export async function AppShell({
  email,
  name = null,
  image = null,
  shortcuts = [],
  children,
}: {
  email: string;
  /** Nombre y foto del proveedor. `null` con email y contraseña. */
  name?: string | null;
  image?: string | null;
  /** Los Proyectos del usuario. Vacío hasta el #9, que trae el CRUD. */
  shortcuts?: ProjectShortcut[];
  children: React.ReactNode;
}) {
  const collapsed = isSidebarCollapsed(
    (await cookies()).get(SIDEBAR_COOKIE)?.value
  );

  return (
    <DashboardNav
      initialCollapsed={collapsed}
      shortcuts={shortcuts}
      email={email}
      name={name}
      image={image}
    >
      {children}
    </DashboardNav>
  );
}
