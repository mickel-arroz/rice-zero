"use client";

import Link from "next/link";

import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { ChevronRightIcon } from "@/components/icons/chevron-right-icon";
import type { IconComponent } from "@/components/icons/types";

/**
 * Las filas de la navegación del dashboard.
 *
 * Existen aquí, y no dentro de la sidebar, porque la sidebar de escritorio y el
 * menú móvil pintan LAS MISMAS filas — solo cambia el alto. Mientras compartan
 * componente, el estado activo no puede significar una cosa en un formato y
 * otra en el otro; el día que se dupliquen, sí.
 *
 * El lenguaje de estado, en un sitio:
 *   reposo  → texto normal, icono apagado
 *   hover   → texto e icono en el rojo de marca, SIN relleno
 *   activo  → pastilla `--accent`, todo en rojo, y el punto de 8 px
 */

/** El punto rojo que ya precede a cada etiqueta de sección en toda la app. */
function ActiveDot() {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-primary"
    />
  );
}

/**
 * El icono NO hereda el color del texto: se le fija aparte.
 *
 * Y por eso el hover tiene que fijárselo también. `hover:text-primary` a secas
 * no alcanza a un `<svg>` que ya tiene su propio color declarado — `currentColor`
 * solo hereda mientras nadie más lo escriba. Sin el segundo selector, el icono
 * se queda apagado al pasar por encima.
 */
const ROW_CLASS =
  "flex items-center rounded-full px-4 transition-colors hover:text-primary hover:[&_svg]:text-primary [&_svg]:transition-colors";

const IDLE_CLASS = "text-foreground [&_svg]:text-muted-foreground";

const ACTIVE_CLASS = "bg-accent text-primary [&_svg]:text-primary";

/**
 * `px-4` también plegada, en vez de centrar.
 *
 * Con la sidebar a 76 px y `px-3` en el contenedor, la fila ocupa de 12 a 64 y
 * el icono cae de 28 a 48 — centrado exacto, y en la MISMA coordenada que
 * ocupa desplegada. Centrar con `justify-center` daría lo mismo hoy y dejaría
 * de darlo en cuanto alguien tocase un relleno; así el icono no puede moverse.
 */
export interface NavRowProps {
  href?: string;
  label: string;
  icon: IconComponent;
  active?: boolean;
  /** Plegada: sin etiqueta, sin punto, sin chevrón. */
  collapsed?: boolean;
  /** 44 en escritorio, 52 en el menú móvil para dar blanco de dedo. */
  height?: number;
  /** `undefined` en una fila que no despliega nada. */
  expanded?: boolean;
  onClick?: () => void;
  /** Lo que se lee en voz alta cuando la etiqueta no basta o no se ve. */
  ariaLabel?: string;
}

export function NavRow({
  href,
  label,
  icon: Icon,
  active = false,
  collapsed = false,
  height = 44,
  expanded,
  onClick,
  ariaLabel,
}: NavRowProps) {
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  const spokenLabel = ariaLabel ?? label;

  const content = collapsed ? (
    <Icon />
  ) : (
    <>
      <Icon />
      <span className="flex-1 truncate text-[15px] tracking-[0.01em]">
        {label}
      </span>
      {active ? <ActiveDot /> : null}
      {expanded === undefined ? null : (
        <Chevron width={16} height={16} className="shrink-0" />
      )}
    </>
  );

  const className = [
    ROW_CLASS,
    collapsed ? "" : "gap-2.5",
    active ? ACTIVE_CLASS : IDLE_CLASS,
  ].join(" ");

  // `style` y no una clase de Tailwind: el alto es un dato que viaja como prop
  // entre dos formatos, y una clase construida desde una variable no llega a
  // existir en el CSS generado.
  const style = { height: `${height}px` };

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? spokenLabel : undefined}
        title={collapsed ? spokenLabel : undefined}
        className={className}
        style={style}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={collapsed || ariaLabel ? spokenLabel : undefined}
      title={collapsed ? spokenLabel : undefined}
      className={`${className} w-full text-left`}
      style={style}
    >
      {content}
    </button>
  );
}

/**
 * El acceso directo a un Proyecto, dentro de la sección desplegada.
 *
 * Un escalón por debajo de un destino: más bajo, texto más pequeño y sin punto
 * — la pastilla ya dice cuál está abierto, y el punto es el marcador del
 * destino de primer nivel.
 */
export function ProjectRow({
  href,
  name,
  icon: Icon,
  active = false,
  collapsed = false,
  height = 38,
  fontSize = 14,
  onClick,
}: {
  href: string;
  name: string;
  icon: IconComponent;
  active?: boolean;
  collapsed?: boolean;
  height?: number;
  /** El tamaño del NOMBRE. El icono es siempre de 18. */
  fontSize?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? name : undefined}
      title={collapsed ? name : undefined}
      onClick={onClick}
      className={`${ROW_CLASS} ${collapsed ? "" : "gap-2.5"} ${
        active ? ACTIVE_CLASS : IDLE_CLASS
      }`}
      style={{ height: `${height}px` }}
    >
      <Icon width={18} height={18} />
      {collapsed ? null : (
        <span className="truncate" style={{ fontSize: `${fontSize}px` }}>
          {name}
        </span>
      )}
    </Link>
  );
}

/**
 * La lista de accesos directos.
 *
 * La línea vertical cae por el centro del icono de «Proyectos» (26 px dentro
 * del contenedor): el mismo recurso con el que la Vista Registro relaciona
 * nodos, reutilizado aquí para decir lo mismo — esto cuelga de aquello.
 */
export function ProjectTree({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-0.5 ml-[26px] flex flex-col gap-0.5 border-l border-border pl-3">
      {children}
    </div>
  );
}
