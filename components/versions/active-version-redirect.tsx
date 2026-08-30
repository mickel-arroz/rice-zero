"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CTA_SECONDARY_CLASS } from "@/components/layout/site-chrome";
import { ErrorCard } from "@/components/ui/error-card";
import { ROUTES, TREE_COPY, VERSIONS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { versionService } from "@/lib/services/versions";

/**
 * Entrar en un Proyecto sin decir qué Versión: abre la más reciente.
 *
 * Es lo que sostiene el acceso directo de la sidebar y las tarjetas de la
 * lista, que enlazan al Proyecto y no pueden enlazar a una Versión cuyo id no
 * conocen. Desde #14 la Versión va en la URL, así que esta ruta ya no pinta el
 * árbol: resuelve cuál es la activa y manda allí.
 *
 * ── Por qué el redirect es de CLIENTE ─────────────────────────────────────
 *
 * Porque no hay otro sitio desde el que hacerlo. El ADR 0001 decide que el
 * navegador habla DIRECTO con PostgREST y que la autorización se queda en RLS,
 * y por eso `ServerBackendProvider` solo expone la sesión: no tiene
 * repositorios. Un `redirect()` de servidor tendría que preguntar cuál es la
 * Versión activa, y desde el servidor no hay a quién preguntárselo.
 *
 * El precio es un salto visible, y por eso esto enseña la misma silueta que
 * enseñaría la pantalla de destino en vez de una página en blanco: lo que se ve
 * al pulsar es «cargando el árbol», que es exactamente lo que está pasando.
 *
 * `replace` y no `push`: esta ruta es un desvío, no un sitio. Con `push`, el
 * botón de atrás desde la Versión volvería aquí y aquí volvería a mandarte
 * adelante — un bucle del que solo se sale pulsando muy rápido.
 */
export function ActiveVersionRedirect({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Sube cada vez que se reintenta, para volver a lanzar el efecto.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;

    versionService()
      .active(projectId)
      .then((version) => {
        if (alive) router.replace(ROUTES.version(projectId, version.id));
      })
      .catch((cause: unknown) => {
        if (alive) setError(errorMessage(cause));
      });

    return () => {
      alive = false;
    };
  }, [projectId, router, attempt]);

  // El error se limpia AQUÍ y no al principio del efecto: un `setState` en el
  // cuerpo de un efecto encadena un render de más, y lo que de verdad quiere
  // decir «ya no hay error» es el gesto de reintentar, no el efecto que
  // provoca.
  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 lg:px-16 lg:py-10">
      <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-3xl">
        {error ? (
          <ErrorCard title={VERSIONS_COPY.errorTitle} body={error}>
            <button
              type="button"
              onClick={retry}
              className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
            >
              {TREE_COPY.retry}
            </button>
          </ErrorCard>
        ) : (
          // La silueta ya dice la forma; esto es para quien no la ve.
          <p role="status" className="sr-only">
            {TREE_COPY.loading}
          </p>
        )}
      </div>
    </main>
  );
}
