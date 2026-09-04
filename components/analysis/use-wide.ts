"use client";

import { useSyncExternalStore } from "react";

/**
 * Si hay ancho suficiente para ACOPLAR el panel al lado del árbol.
 *
 * Existe aparte de `useDesktop` y la diferencia es una condición: aquélla
 * pregunta además por `hover: hover` porque decide si se puede ARRASTRAR, y un
 * dedo no arrastra un Nodo. Ésta decide si CABEN dos columnas, que es una
 * pregunta sobre el espacio y no sobre el puntero — una tableta grande en
 * horizontal tiene sitio de sobra para el panel acoplado, y en ella la hoja
 * inferior taparía media pantalla para nada.
 *
 * Y llega a JavaScript en vez de resolverse con `lg:` por lo mismo que
 * `useDesktop`: no es una clase lo que cambia, es DÓNDE se monta el panel. Los
 * dos sitios —hoja inferior y columna acoplada— no pueden montarse a la vez y
 * esconderse uno con CSS, porque el panel lleva un `id` al que apunta el enlace
 * de «Corregir con Directrices»: duplicado, el ancla saltaría al que está
 * oculto.
 *
 * `useSyncExternalStore` con `false` en el servidor, igual que `useDesktop`:
 * arranca como hoja y la hidratación la acopla si hay sitio. Al revés dejaría
 * un hueco de 440 px pintado en un teléfono durante el primer fotograma.
 */
const WIDE_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
