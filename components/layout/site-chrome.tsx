import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_NAME, EXTERNAL_LINKS, ROUTES } from "@/lib/constants";

/** Página pública en la que estamos: decide a dónde apunta la navegación. */
type PublicPage = "home" | "about";

/**
 * Enlace de texto de la app: subrayado punteado que se pone rojo al pasar por
 * encima, como el resto de detalles.
 */
export const LINK_CLASS =
  "underline decoration-dotted decoration-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:decoration-primary";

/** Etiqueta de sección en versalitas. */
export const LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

/** Tarjeta con borde sutil que se enciende en rojo al pasar por encima. */
export const CARD_CLASS =
  "rounded-[20px] border border-border bg-card transition-colors hover:border-primary";

export function SiteHeader({ current }: { current: PublicPage }) {
  const brandClass =
    "font-display text-[21px] tracking-[0.04em] lg:text-[22px]";

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4 lg:px-16">
      {current === "home" ? (
        <span className={brandClass}>{APP_NAME}</span>
      ) : (
        <Link href={ROUTES.home} className={brandClass}>
          {APP_NAME}
        </Link>
      )}
      <div className="flex items-center gap-5">
        {current === "home" ? (
          // En móvil la landing ya ofrece su propio enlace a /about bajo el hero.
          <Link
            href={ROUTES.about}
            className={`hidden text-sm sm:inline ${LINK_CLASS}`}
          >
            Acerca de
          </Link>
        ) : (
          <Link
            href={ROUTES.home}
            className={`text-[13px] lg:text-sm ${LINK_CLASS}`}
          >
            Inicio
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

export function SiteFooter({ current }: { current: PublicPage }) {
  return (
    <footer className="mt-10 flex flex-col gap-2.5 border-t border-border bg-background px-6 py-6 lg:mt-0 lg:flex-row-reverse lg:items-center lg:justify-between lg:px-16">
      <div className="flex gap-4 text-[13px] lg:gap-5">
        {current === "home" ? (
          <Link href={ROUTES.about} className={LINK_CLASS}>
            Acerca de
          </Link>
        ) : (
          <Link href={ROUTES.home} className={LINK_CLASS}>
            Inicio
          </Link>
        )}
        <a
          href={EXTERNAL_LINKS.repo}
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS}
        >
          GitHub
        </a>
      </div>
      <span className="text-xs text-muted-foreground">© 2026 {APP_NAME}</span>
    </footer>
  );
}
