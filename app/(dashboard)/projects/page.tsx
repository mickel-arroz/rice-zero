import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlusIcon } from "@/components/icons/plus-icon";
import {
  CTA_PRIMARY_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
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
 * `app/(dashboard)/layout.tsx`, así que aquí solo vive el contenido. La lista
 * de Proyectos en rejilla de tarjetas la trae el #9; hasta entonces esto
 * enseña el empty state.
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

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-16 lg:py-10">
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className={LABEL_CLASS}>{PROJECTS_COPY.label}</span>
        </p>
        <h1 className="text-4xl leading-none tracking-[0.02em] lg:text-[56px]">
          {PROJECTS_COPY.title}
        </h1>
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
  );
}
