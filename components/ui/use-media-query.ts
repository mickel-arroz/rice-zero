"use client";

import { useSyncExternalStore } from "react";

/**
 * Si una consulta de medios se cumple ahora mismo, y repintando cuando cambia.
 *
 * Existe porque ya hay DOS preguntas distintas que necesitan llegar a
 * JavaScript —`useDesktop`, para saber si se puede arrastrar un Nodo, y
 * `useWide`, para saber si el Panel de IA cabe acoplado— y el cableado de las
 * dos es idéntico. Lo único que cambiaba entre ellas era la cadena de la
 * consulta, y eso no justifica dos copias del mismo `subscribe`.
 *
 * `useSyncExternalStore` y no un `useEffect` con estado: en el servidor no hay
 * ventana que medir, y `false` es la respuesta correcta allí — se arranca con
 * el formato pequeño y lo agranda la hidratación, en vez de prometer un ancho
 * que todavía no se sabe. Al revés se pintaría un fotograma con la maqueta de
 * escritorio dentro de un teléfono.
 *
 * Lo que NO vive aquí son las consultas. Cada una es una decisión con su porqué
 * —por qué `hover: hover` en una y no en la otra— y ese porqué pertenece al
 * hook que la hace, no a este cableado.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
