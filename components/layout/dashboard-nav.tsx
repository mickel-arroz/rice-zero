"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronsLeftIcon } from "@/components/icons/chevrons-left-icon";
import { ChevronsRightIcon } from "@/components/icons/chevrons-right-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { ContrastIcon } from "@/components/icons/contrast-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { InfoIcon } from "@/components/icons/info-icon";
import { MenuIcon } from "@/components/icons/menu-icon";
import { projectIconFor } from "@/components/icons/projects";
import { useProjects } from "@/components/projects/projects-provider";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppFrame } from "@/components/layout/app-frame";
import { MenuPill, NavRow, ProjectRow } from "@/components/layout/nav-row";
import {
  BRAND_CLASS,
  ICON_BUTTON_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import { useThemeToggle } from "@/components/theme/theme-toggle";
import { isSameOrUnder, normalizePath } from "@/lib/path";
import { activeDestination } from "@/lib/shell/destinations";
import { sidebarCookieAssignment } from "@/lib/shell/sidebar";
import {
  APP_NAME,
  ROUTES,
  SHELL_COPY,
  THEME_TOGGLE_LABEL,
} from "@/lib/constants";

interface DashboardNavProps {
  /** Lo lee el servidor de la cookie, para que el primer HTML ya venga bien. */
  initialCollapsed: boolean;
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

/**
 * El alto de fila del menú del teléfono, y también el de sus dos pastillas del
 * pie: 46, del boceto. Sube de los 44 de escritorio para dar blanco de dedo sin
 * llegar a los 52 que tenía antes, que con la lista de Proyectos ya sin
 * agrupador dejaban el menú más largo que la pantalla.
 */
const MOBILE_ROW = 46;

/** El acceso a un Proyecto, un escalón por debajo de un destino. */
const PROJECT_ROW = 38;

export function DashboardNav({
  initialCollapsed,
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

  // Los mismos Proyectos que pinta la pantalla, del mismo provider: crear uno
  // lo hace aparecer aquí sin recargar, y borrarlo lo quita.
  const { projects } = useProjects();

  const pathname = usePathname();
  const active = activeDestination(pathname);
  const { toggle: toggleTheme } = useThemeToggle();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = sidebarCookieAssignment(next);
  }

  const path = normalizePath(pathname);

  /**
   * «Inicio» marca la LISTA, no todo lo que cuelga de ella.
   *
   * Con `activeDestination` —que compara por segmento— también se encendía
   * dentro de un Proyecto, y entonces la pastilla aparecía dos veces en la
   * misma columna: en Inicio y en el Proyecto abierto. El destino y el atajo
   * son ahora dos alturas de la misma lista, así que solo una puede estar
   * encendida.
   */
  const homeActive = path === ROUTES.projects;
  const aboutActive = active === "about";

  /** Los accesos directos, o el aviso de que todavía no hay ninguno. */
  function shortcutList(
    onNavigate?: () => void,
    height = 38,
    fontSize = 14,
    isCollapsed = false
  ) {
    if (projects.length === 0) {
      return isCollapsed ? null : (
        <span className={`${LABEL_CLASS} block px-3 py-2`}>
          {SHELL_COPY.noShortcuts}
        </span>
      );
    }
    return projects.map((project) => (
      <ProjectRow
        key={project.id}
        href={ROUTES.project(project.id)}
        name={project.title}
        // Nunca lanza: una clave que no reconoce cae al icono por defecto.
        icon={projectIconFor(project.icon)}
        // Same-or-under y no igualdad exacta: dentro de una Versión la ruta
        // lleva un segmento más, y con `===` no quedaba encendida ninguna fila
        // — justo donde más falta hace saber dónde se está.
        active={isSameOrUnder(path, ROUTES.project(project.id))}
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
        //
        // Sin borde derecho: el contenedor flotante arranca justo donde acaba
        // esta columna, así que los dos bordes juntos se leían como un trazo de
        // 2 px. La separación la hace el margen del contenedor.
        //
        // `sticky top-0 h-dvh`: la columna deja de estirarse con la página. Sin
        // alto propio, una columna de flex crece hasta igualar al contenido, así
        // que en una pantalla larga «Acerca de» y la cuenta acababan a miles de
        // píxeles de scroll. Con un alto de ventana y `sticky`, plegar y el
        // resto de las opciones siguen donde estaban mientras se lee.
        //
        // `h-dvh` y no `h-screen`: en el teléfono no se ve —esto es `lg:`— pero
        // en una ventana de escritorio con la barra de la PWA `100vh` mide de
        // más y la fila de abajo se sale por debajo del borde.
        className="sticky top-0 hidden h-dvh shrink-0 flex-col bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
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

        {/* `min-h-0` además de `flex-1`: un hijo de flex no baja de su tamaño
            de contenido salvo que se le diga, así que sin esto la lista no se
            recorta —empuja— y el scroll propio nunca llega a existir. Con él,
            los Proyectos se desplazan dentro de su columna y el bloque de abajo
            se queda donde está. Sustituye al `flex-1` vacío que antes empujaba:
            quien crece es ahora quien puede desplazarse. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          <NavRow
            href={ROUTES.projects}
            label={SHELL_COPY.home}
            icon={HomeIcon}
            active={homeActive}
            collapsed={collapsed}
            height={DESKTOP_ROW}
          />
          {/* El respiro entre el punto de vuelta y lo que se alcanza desde él.
              6 px, del boceto: menos y las dos alturas de fila se leían como
              una sola lista; más y la de arriba parecía de otra sección. */}
          <div className="h-1.5 shrink-0" />
          {shortcutList(undefined, PROJECT_ROW, 14, collapsed)}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-border p-3">
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
        {/* `sticky` y no `fixed`, por lo mismo que la franja de conexión: en
            flujo ocupa su alto y empuja al contenido, así que no puede tapar el
            primer elemento. `fixed` habría exigido un relleno de compensación
            calculado a mano, y ese número se desincroniza el día que la barra
            cambie de alto.

            `z-30`: por encima de la tarjeta y de lo que flote dentro de ella,
            y por debajo del `z-50` de la franja de conexión — que cuando
            aparece manda, porque dice que no hay red.

            Solo en móvil: por encima de `lg` esta cabecera no existe, y la
            navegación fija es la columna de la izquierda. */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-border bg-background px-6 py-4 lg:hidden">
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
          <nav className="flex flex-1 flex-col px-6 pt-5 pb-6 lg:hidden">
            {/* La navegación crece y se desplaza; lo secundario se queda
                abajo. Con la lista de Proyectos ya sin agrupador, dejarla en
                flujo hacía que a partir de una docena el pie se saliera de la
                pantalla — y el pie es justo lo que este ticket coloca. */}
            <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              <NavRow
                href={ROUTES.projects}
                label={SHELL_COPY.home}
                icon={HomeIcon}
                active={homeActive}
                height={MOBILE_ROW}
                onClick={() => setMenuOpen(false)}
              />
              <div className="h-1.5 shrink-0" />
              {shortcutList(() => setMenuOpen(false), MOBILE_ROW, 15)}
            </div>

            {/* El pie: la cuenta, y debajo las dos opciones secundarias en una
                sola fila. Que compartan fila es lo que las saca de la lista de
                destinos — mientras ocupaban un renglón cada una se leían como
                dos sitios más a los que ir. */}
            <div className="mt-3.5 shrink-0 border-t border-border pt-3">
              <AccountMenu
                email={email}
                name={name}
                image={image}
                collapsed={false}
                height={MOBILE_ROW}
              />
              <div className="mt-2 flex gap-2">
                <MenuPill
                  href={ROUTES.about}
                  label={SHELL_COPY.about}
                  icon={InfoIcon}
                  height={MOBILE_ROW}
                  onClick={() => setMenuOpen(false)}
                />
                <MenuPill
                  label={SHELL_COPY.theme}
                  ariaLabel={THEME_TOGGLE_LABEL}
                  icon={ContrastIcon}
                  height={MOBILE_ROW}
                  onClick={toggleTheme}
                />
              </div>
            </div>
          </nav>
        ) : null}

        {/* El menú REEMPLAZA el contenido en móvil, no lo tapa. En `lg` no
            existe menú, así que el contenido vuelve pase lo que pase con
            `menuOpen` — quien abre el menú y luego agranda la ventana no se
            queda con la pantalla en blanco. */}
        <AppFrame className={menuOpen ? "hidden lg:flex" : ""}>
          {children}
        </AppFrame>
      </div>
    </div>
  );
}
