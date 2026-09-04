"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";

import { SERVICE_WORKER_URL } from "@/lib/constants";

/**
 * Registra el service worker y va guardando lo que se navega.
 *
 * Es un envoltorio fino sobre `SerwistProvider` para que las dos decisiones de
 * abajo estén escritas donde se toman, y no perdidas entre los valores por
 * defecto de un paquete.
 */
export function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl={SERVICE_WORKER_URL}
      /**
       * Por defecto es `true` y hace `location.reload()` en cuanto el navegador
       * dispara `online`. Aquí eso es hostil: recargar entero al reconectar se
       * lleva por delante lo que el usuario tenga a medio escribir en un Nodo,
       * que es exactamente el momento en que menos se le puede tirar la página.
       * Y sobra: `experimental.useOffline` ya reintenta solo lo que se quedó
       * pendiente, sin recargar nada.
       */
      reloadOnOnline={false}
      /**
       * Esto sí se queda encendido: es lo que guarda cada ruta a la que se
       * navega, y por tanto lo que hace que «lo navegado con conexión sea
       * consultable sin conexión» sea verdad y no solo lo que caiga por suerte
       * en el `NetworkFirst` de `defaultCache`.
       */
      cacheOnNavigation
    >
      {children}
    </SerwistProvider>
  );
}
