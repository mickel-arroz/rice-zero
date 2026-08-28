import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_NAME, EXTERNAL_LINKS, ROUTES, SHELL_COPY } from "@/lib/constants";

/** Página pública en la que estamos: decide a dónde apunta la navegación. */
type PublicPage = "home" | "about" | "login";

/**
 * Enlace de texto de la app: subrayado punteado que se pone rojo al pasar por
 * encima, como el resto de detalles.
 */
export const LINK_CLASS =
  "underline decoration-dotted decoration-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:decoration-primary";

/** Etiqueta de sección en versalitas. */
export const LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

/**
 * El envoltorio de toda página.
 *
 * `relative z-10` no es decorativo: el fondo de puntos vive en el layout raíz
 * (`app/layout.tsx`) como hermano `fixed` del contenido, así que sin esto la
 * página quedaría DEBAJO del fondo. Está aquí para que ninguna ruta nueva se
 * olvide de la mitad que la hace visible.
 */
export const PAGE_CLASS = "relative z-10 flex flex-1 flex-col";

/** La marca, en NDot. La comparten la cabecera pública y la de la app. */
export const BRAND_CLASS =
  "font-display text-[21px] tracking-[0.04em] lg:text-[22px]";

/** Tarjeta con borde sutil que se enciende en rojo al pasar por encima. */
export const CARD_CLASS =
  "rounded-[20px] border border-border bg-card transition-colors hover:border-primary";

/**
 * La pastilla de acción: versalitas, 15px bold, alto 52 (56 en escritorio).
 *
 * Vive aquí y no en la landing porque la comparten la landing y el login, y dos
 * copias del mismo botón se desincronizan en cuanto alguien toca una.
 */
export const CTA_CLASS =
  "flex h-13 items-center justify-center gap-2.5 rounded-full text-[15px] font-bold uppercase tracking-[0.08em] transition-colors lg:h-14 lg:px-10";

export const CTA_PRIMARY_CLASS = `${CTA_CLASS} bg-primary text-primary-foreground hover:opacity-90`;

export const CTA_SECONDARY_CLASS = `${CTA_CLASS} border border-border hover:border-primary hover:text-primary`;

/**
 * El botón redondo de 36 px con borde que se enciende: el toggle de tema en las
 * páginas públicas, la hamburguesa en la cabecera del dashboard. Vive aquí
 * porque dos copias del mismo botón se desincronizan en cuanto alguien toca una.
 */
export const ICON_BUTTON_CLASS =
  "flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary";

export function SiteHeader({ current }: { current: PublicPage }) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-4 lg:px-16">
      {current === "home" ? (
        <span className={BRAND_CLASS}>{APP_NAME}</span>
      ) : (
        <Link href={ROUTES.home} className={BRAND_CLASS}>
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
            {SHELL_COPY.about}
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
            {SHELL_COPY.about}
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
