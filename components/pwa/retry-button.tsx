"use client";

import { useOffline } from "next/offline";

import { CTA_PRIMARY_CLASS } from "@/components/layout/site-chrome";
import { PWA_COPY } from "@/lib/constants";

/**
 * El botón de reintentar, que se apaga mientras no haya red.
 *
 * Deshabilitarlo no es adorno: la pantalla offline llega desde una ruta que YA
 * falló, así que recargar sin conexión vuelve aquí mismo. Un botón que parece
 * hacer algo y devuelve a la misma pantalla se lee como que la app está rota.
 *
 * Es la única parte interactiva de `/offline`, y por eso está suelta: el resto
 * de la pantalla se queda como Server Component estático y precacheable.
 */
export function RetryButton() {
  const isOffline = useOffline();

  return (
    <button
      type="button"
      // `location.reload()` y no `router.refresh()`: se llega aquí por una
      // navegación que el worker no pudo resolver, y lo que hay que repetir es
      // la petición del documento entero.
      onClick={() => location.reload()}
      disabled={isOffline}
      className={`${CTA_PRIMARY_CLASS} px-8 disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {PWA_COPY.offlineRetry}
    </button>
  );
}
