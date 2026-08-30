"use client";

import Link from "next/link";

import { CTA_SECONDARY_CLASS } from "@/components/layout/site-chrome";
import { ErrorCard } from "@/components/ui/error-card";
import { useVersions } from "@/components/versions/versions-provider";
import { ROUTES, TREE_COPY, VERSIONS_COPY } from "@/lib/constants";

/**
 * La puerta de la pantalla: no se edita hasta saber QUÉ se está editando.
 *
 * Existe porque calcular una validación no es aplicarla. `VersionsProvider` ya
 * deducía que el `versionId` de la URL no estaba en la lista del Proyecto, y
 * eso no bastaba: el árbol se montaba igual, y bajo RLS `nodeService().list()`
 * sobre un id ajeno no falla — devuelve CERO filas. El resultado era una
 * Versión inexistente disfrazada de Versión vacía, con el botón «Primer Nodo»
 * vivo, escribiendo Nodos contra una Versión que no está.
 *
 * Así que la comprobación pasa a ser una puerta de verdad: mientras no haya una
 * Versión confirmada, debajo no se pinta nada con lo que se pueda escribir.
 *
 * ── Por qué la puerta va DENTRO de `TreeProvider` y no fuera ───────────────
 *
 * Para no serializar dos peticiones que pueden ir a la vez. `TreeProvider`
 * queda montado por encima de esto, así que su lectura del árbol sale a la vez
 * que la lista de Versiones; lo único que la puerta retiene es lo que se PINTA.
 * Poniéndola fuera, la lectura del árbol no empezaría hasta que la lista
 * volviera, y abrir un Proyecto costaría un viaje de más siempre — para
 * protegerse de un caso que casi nunca ocurre.
 *
 * ── Por qué la salida enseña la lista ─────────────────────────────────────
 *
 * «La Versión activa es siempre visible y conmutable» es un criterio del
 * ticket, y una pantalla de error sin salida lo incumple: el selector vive en
 * la cabecera del árbol, que aquí no se pinta, así que sin esta lista la única
 * forma de salir sería el botón de atrás del navegador.
 */
export function VersionGate({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const { status, versions, current, error, reload } = useVersions();

  if (current) return <>{children}</>;

  return (
    <main className="flex flex-1 flex-col px-6 py-6 lg:px-16 lg:py-10">
      <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-3xl">
        {status === "loading" ? (
          // La silueta ya dice la forma; esto es para quien no la ve.
          <p role="status" className="sr-only">
            {VERSIONS_COPY.loading}
          </p>
        ) : status === "error" ? (
          <ErrorCard
            title={VERSIONS_COPY.errorTitle}
            body={error ?? TREE_COPY.errorBody}
          >
            <button
              type="button"
              onClick={() => void reload()}
              className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
            >
              {TREE_COPY.retry}
            </button>
          </ErrorCard>
        ) : (
          <ErrorCard
            title={VERSIONS_COPY.goneTitle}
            body={
              versions.length > 0 ? VERSIONS_COPY.gone : VERSIONS_COPY.goneEmpty
            }
          >
            {versions.length > 0 ? (
              <ul className="mt-1 flex w-full max-w-80 flex-col gap-0.5">
                {versions.map((version) => (
                  <li key={version.id}>
                    <Link
                      href={ROUTES.version(projectId, version.id)}
                      className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm transition-colors hover:bg-accent hover:text-primary"
                    >
                      <span className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">
                        {TREE_COPY.versionChip(version.versionNumber)}
                      </span>
                      <span className="truncate">
                        {TREE_COPY.versionName(
                          version.versionNumber,
                          version.label,
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              // Sin Versiones no hay a dónde ir dentro del Proyecto. Pasa
              // cuando el Proyecto tampoco es tuyo: la lista llega vacía y
              // esto es la única salida honesta.
              <Link href={ROUTES.projects} className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}>
                {VERSIONS_COPY.backToProjects}
              </Link>
            )}
          </ErrorCard>
        )}
      </div>
    </main>
  );
}
