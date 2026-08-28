"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronsLeftIcon } from "@/components/icons/chevrons-left-icon";
import { ChevronsRightIcon } from "@/components/icons/chevrons-right-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { ContrastIcon } from "@/components/icons/contrast-icon";
import { FolderIcon } from "@/components/icons/folder-icon";
import { InfoIcon } from "@/components/icons/info-icon";
import { MenuIcon } from "@/components/icons/menu-icon";
import { projectIconFor } from "@/components/icons/projects";
import { AccountMenu } from "@/components/layout/account-menu";
import { NavRow, ProjectRow, ProjectTree } from "@/components/layout/nav-row";
import {
  BRAND_CLASS,
  ICON_BUTTON_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import { useThemeToggle } from "@/components/theme/theme-toggle";
import { activeDestination } from "@/lib/shell/destinations";
import { sidebarCookieAssignment } from "@/lib/shell/sidebar";
import {
  APP_NAME,
  PROJECTS_COPY,
  ROUTES,
  SHELL_COPY,
  THEME_TOGGLE_LABEL,
} from "@/lib/constants";

/** Un acceso directo a un Proyecto en la navegación. */
export interface ProjectShortcut {
  id: string;
  name: string;
  /**
   * Clave del catálogo de `components/icons/projects`.
   *
   * `string` y no `ProjectIconKey` a propósito: llega de una fila de base de
   * datos, que puede haberla escrito una versión anterior de la app. Quien la
   * valida es `projectIconFor`, que cae al icono por defecto.
   */
  icon: string;
}

interface DashboardNavProps {
  /** Lo lee el servidor de la cookie, para que el primer HTML ya venga bien. */
  initialCollapsed: boolean;
  shortcuts: ProjectShortcut[];
  email: string;
  name: string | null;
  image: string | null;
  children: React.ReactNode;
}

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 76;

/**
 * El alto del bloque de la marca, fijo.
 *
 * `RICE(0)` a 22 px y `R(0)` a 18 px no miden lo mismo, así que dejar que el
 * bloque se ajuste al texto desplazaba verticalmente TODA la navegación al
 * plegar. Con un alto fijo, plegar solo cambia el ancho.
 */
const BRAND_HEIGHT = 78;

const DESKTOP_ROW = 44;
const MOBILE_ROW = 52;

export function DashboardNav({
  initialCollapsed,
  shortcuts,
  email,
  name,
  image,
  children,
}: DashboardNavProps) {
  // El servidor ya pintó el ancho correcto leyendo la cookie; a partir de aquí
  // el estado es del cliente para que plegar sea instantáneo y no un viaje al
  // servidor. La cookie se reescribe en cada cambio para la próxima petición.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  // Uno por formato: son dos navegaciones que se ven en momentos distintos, y
  // compartir el estado hacía que plegar la sección en escritorio abriera el
  // menú del teléfono con los accesos escondidos.
  const [sidebarProjectsOpen, setSidebarProjectsOpen] = useState(true);
  const [menuProjectsOpen, setMenuProjectsOpen] = useState(true);

  const pathname = usePathname();
  const active = activeDestination(pathname);
  const { toggle: toggleTheme } = useThemeToggle();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookieAssignment(next);
  }

  const projectsActive = active === "projects";
  const aboutActive = active === "about";
  const projectHref = (id: string) => `${ROUTES.projects}/${id}`;

  /** Los accesos directos, o el aviso de que todavía no hay ninguno. */
  function shortcutList(
    onNavigate?: () => void,
    height = 38,
    fontSize = 14,
    isCollapsed = false
  ) {
    if (shortcuts.length === 0) {
      return isCollapsed ? null : (
        <span className={`${LABEL_CLASS} block px-3 py-2`}>
          {SHELL_COPY.noShortcuts}
        </span>
      );
    }
    return shortcuts.map((project) => (
      <ProjectRow
        key={project.id}
        href={projectHref(project.id)}
        name={project.name}
        icon={projectIconFor(project.icon)}
        active={pathname === projectHref(project.id)}
        collapsed={isCollapsed}
        height={height}
        fontSize={fontSize}
        onClick={onNavigate}
      />
    ));
  }

  const themeRow = (height: number, isCollapsed: boolean) => (
    <NavRow
      label={SHELL_COPY.theme}
      ariaLabel={THEME_TOGGLE_LABEL}
      icon={ContrastIcon}
      collapsed={isCollapsed}
      height={height}
      onClick={toggleTheme}
    />
  );

  return (
    // `relative z-10`: el fondo de puntos vive en el layout raíz como hermano
    // `fixed`, así que sin esto el shell entero quedaría DEBAJO de él.
    <div className="relative z-10 flex flex-1">
      {/* ── Sidebar de escritorio ──────────────────────────────────── */}
      <aside
        // Por debajo de `lg` la navegación es el menú de la cabecera, no esta
        // columna. `transition-[width]` anima el plegado; `motion-reduce` lo
        // apaga para quien pidió menos movimiento en su sistema.
        className="hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
        style={{
          width: `${collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED}px`,
        }}
      >
        <div
          className={`flex shrink-0 items-center ${collapsed ? "justify-center" : "px-6"}`}
          style={{ height: `${BRAND_HEIGHT}px` }}
        >
          <Link
            href={ROUTES.projects}
            className={
              collapsed ? "font-display text-lg tracking-[0.04em]" : BRAND_CLASS
            }
          >
            {collapsed ? SHELL_COPY.brandShort : APP_NAME}
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-2">
          <NavRow
            // Plegada la fila deja de desplegar y pasa a navegar: no hay sitio
            // para una lista, así que el clic tiene que llevar a algo.
            href={collapsed ? ROUTES.projects : undefined}
            label={PROJECTS_COPY.title}
            icon={FolderIcon}
            active={projectsActive}
            collapsed={collapsed}
            expanded={collapsed ? undefined : sidebarProjectsOpen}
            onClick={
              collapsed ? undefined : () => setSidebarProjectsOpen((v) => !v)
            }
          />
          {collapsed ? (
            <div className="flex flex-col gap-0.5">
              {shortcutList(undefined, 36, 14, true)}
            </div>
          ) : sidebarProjectsOpen ? (
            <ProjectTree>{shortcutList()}</ProjectTree>
          ) : null}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-0.5 border-t border-border p-3">
          <NavRow
            label={collapsed ? SHELL_COPY.expandSidebar : SHELL_COPY.collapse}
            ariaLabel={
              collapsed ? SHELL_COPY.expandSidebar : SHELL_COPY.collapseSidebar
            }
            icon={collapsed ? ChevronsRightIcon : ChevronsLeftIcon}
            collapsed={collapsed}
            height={DESKTOP_ROW}
            onClick={toggleCollapsed}
          />
          <NavRow
            href={ROUTES.about}
            label={SHELL_COPY.about}
            icon={InfoIcon}
            active={aboutActive}
            collapsed={collapsed}
            height={DESKTOP_ROW}
          />
          {themeRow(DESKTOP_ROW, collapsed)}
          <AccountMenu
            email={email}
            name={name}
            image={image}
            collapsed={collapsed}
            height={DESKTOP_ROW}
          />
        </div>
      </aside>

      {/* ── Columna de contenido, con la cabecera móvil encima ──────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-6 py-4 lg:hidden">
          <Link href={ROUTES.projects} className={BRAND_CLASS}>
            {APP_NAME}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? SHELL_COPY.closeMenu : SHELL_COPY.openMenu}
            className={ICON_BUTTON_CLASS}
          >
            {menuOpen ? (
              <CloseIcon width={18} height={18} />
            ) : (
              <MenuIcon width={18} height={18} />
            )}
          </button>
        </header>

        {menuOpen ? (
          <nav className="flex flex-1 flex-col gap-0.5 px-6 pt-5 pb-6 lg:hidden">
            <NavRow
              label={PROJECTS_COPY.title}
              icon={FolderIcon}
              active={projectsActive}
              height={MOBILE_ROW}
              expanded={menuProjectsOpen}
              onClick={() => setMenuProjectsOpen((v) => !v)}
            />
            {menuProjectsOpen ? (
              <ProjectTree>
                {shortcutList(() => setMenuOpen(false), 46, 15)}
              </ProjectTree>
            ) : null}

            <div className="my-3.5 border-t border-border" />

            <NavRow
              href={ROUTES.about}
              label={SHELL_COPY.about}
              icon={InfoIcon}
              active={aboutActive}
              height={MOBILE_ROW}
              onClick={() => setMenuOpen(false)}
            />
            {themeRow(MOBILE_ROW, false)}

            <div className="flex-1" />
            <div className="border-t border-border pt-1">
              <AccountMenu
                email={email}
                name={name}
                image={image}
                collapsed={false}
                height={MOBILE_ROW}
              />
            </div>
          </nav>
        ) : null}

        {/* El menú REEMPLAZA el contenido en móvil, no lo tapa. En `lg` no
            existe menú, así que el contenido vuelve pase lo que pase con
            `menuOpen` — quien abre el menú y luego agranda la ventana no se
            queda con la pantalla en blanco. */}
        <div
          className={`flex flex-1 flex-col ${menuOpen ? "hidden lg:flex" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
