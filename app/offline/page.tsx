import type { Metadata } from "next";
import Link from "next/link";

import { OfflineIcon } from "@/components/icons/offline-icon";
import {
  BRAND_CLASS,
  CARD_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
  PAGE_CLASS,
} from "@/components/layout/site-chrome";
import { RetryButton } from "@/components/pwa/retry-button";
import { APP_NAME, PWA_COPY, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: PWA_COPY.offlineLabel,
  description: PWA_COPY.offlineLead,
};

const POINTS = [
  PWA_COPY.offlineCanRead,
  PWA_COPY.offlineCannotEdit,
  PWA_COPY.offlineWillRetry,
] as const;

/**
 * La pantalla que el service worker sirve cuando se pide una ruta que no tiene
 * guardada y no hay red.
 *
 * Es DELIBERADAMENTE estática: ni sesión ni datos. Tiene que poder salir con la
 * red caída, así que se precachea en el build (ver `additionalPrecacheEntries`
 * en `app/serwist/[path]/route.ts`), y cualquier cosa que leyera cookies la
 * volvería dinámica y por tanto imposible de precachear — que es como el
 * fallback pasa a ser el error del navegador que este ticket quiere evitar.
 *
 * Por lo mismo no lleva el shell del dashboard: `AppShell` pide sesión, y pedir
 * sesión aquí es pedir red.
 */
export default function Offline() {
  return (
    <div className={PAGE_CLASS}>
      <header className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-16">
        {/* La marca no es un enlace: sin red no se sabe si la landing está
            guardada, y una marca que no responde es peor que una que no invita. */}
        <span className={BRAND_CLASS}>{APP_NAME}</span>
        <span className="text-primary">
          <OfflineIcon />
        </span>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 pt-11 pb-14 lg:items-center lg:px-16 lg:pt-22 lg:text-center">
        <div className="flex flex-col gap-5 lg:items-center lg:gap-6">
          <p className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className={`${LABEL_CLASS} lg:text-xs`}>
              {PWA_COPY.offlineLabel}
            </span>
          </p>
          <h1 className="text-[40px] leading-none tracking-[0.02em] lg:text-[76px]">
            {PWA_COPY.offlineTitle}
          </h1>
          <h2 className="max-w-2xl text-[20px] leading-tight font-bold text-pretty lg:text-3xl">
            {PWA_COPY.offlineLead}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground lg:text-[15px]">
            {PWA_COPY.offlineBody}
          </p>
        </div>

        <div
          className={`${CARD_CLASS} flex w-full max-w-2xl flex-col gap-4 p-6 lg:p-7 lg:text-left`}
        >
          <span className={LABEL_CLASS}>{PWA_COPY.offlineAvailable}</span>
          <ul className="flex flex-col gap-2.5">
            {POINTS.map((point) => (
              <li
                key={point}
                className="flex gap-2.5 text-[13px] leading-relaxed text-muted-foreground"
              >
                <span className="text-primary" aria-hidden="true">
                  —
                </span>
                <span className="text-pretty">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <RetryButton />
          {/* Un `Link` normal: si `/projects` está en caché, el service worker
              lo sirve y la navegación ocurre sin red. */}
          <Link href={ROUTES.projects} className={`${CTA_SECONDARY_CLASS} px-8`}>
            {PWA_COPY.offlineBack}
          </Link>
        </div>
      </main>
    </div>
  );
}
