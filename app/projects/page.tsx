import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { PlusIcon } from "@/components/icons/plus-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  BRAND_CLASS,
  CARD_CLASS,
  CTA_PRIMARY_CLASS,
  LABEL_CLASS,
  PAGE_CLASS,
} from "@/components/layout/site-chrome";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { APP_NAME, PROJECTS_COPY, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: PROJECTS_COPY.title,
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * La ruta protegida.
 *
 * Deliberadamente delgada: existe para demostrar que la sesión llega al servidor
 * y que `proxy.ts` cierra la puerta. El armazón de la aplicación —sidebar en
 * escritorio, barra inferior en móvil— es el #8, y el CRUD de Proyectos el #9.
 */
export default async function ProjectsPage() {
  const session = await requestSession();

  // `proxy.ts` ya redirige a quien no puede entrar, y aun así se comprueba otra
  // vez: es lo que la documentación de Next pide («el proxy no debería ser tu
  // única línea de defensa»). Sin esto, un fallo en el matcher del proxy
  // dejaría esta página renderizando sin sesión.
  //
  // `canAct` y no `session !== null`: una cuenta sin el email confirmado tiene
  // sesión pero no puede actuar, y el spec exige la confirmación.
  if (!canAct(session)) redirect(ROUTES.login);

  const { email } = session.user;

  return (
    <div className={PAGE_CLASS}>
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-6 py-4 lg:px-16">
        <Link href={ROUTES.home} className={BRAND_CLASS}>
          {APP_NAME}
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col gap-5 px-6 py-6 lg:mx-auto lg:w-full lg:max-w-3xl lg:px-16">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary"
            />
            <span className={LABEL_CLASS}>{PROJECTS_COPY.label}</span>
          </p>
          <h1 className="text-4xl leading-none tracking-[0.02em] lg:text-[56px]">
            {PROJECTS_COPY.title}
          </h1>
        </div>

        <div className={`${CARD_CLASS} flex flex-col gap-4 p-5`}>
          <div className="flex flex-col gap-2">
            <span className={LABEL_CLASS}>{PROJECTS_COPY.sessionLabel}</span>
            <span className="text-[15px] font-bold break-all">{email}</span>
            <span className="text-xs text-muted-foreground">
              {PROJECTS_COPY.verified}
            </span>
          </div>
          <SignOutButton />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-dashed border-border p-6">
          <span className="font-display text-[15px] text-primary">00</span>
          <p className="text-[15px] font-bold">{PROJECTS_COPY.emptyTitle}</p>
          <p className="max-w-[250px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
            {PROJECTS_COPY.emptyBody}
          </p>
          {/* Inerte hasta el #9, que es el que trae el CRUD de Proyectos. */}
          <span
            aria-disabled="true"
            className={`${CTA_PRIMARY_CLASS} px-6 opacity-45`}
          >
            <PlusIcon />
            {PROJECTS_COPY.emptyCta}
          </span>
        </div>
      </main>
    </div>
  );
}
