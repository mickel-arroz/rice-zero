"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getBackend } from "@/lib/backend";
import { ROUTES } from "@/lib/constants";
import { SIGN_OUT_MESSAGE } from "@/lib/pwa/cache";

/**
 * Cerrar sesión, sin decidir cómo se pinta.
 *
 * Lo usa el desplegable de cuenta del shell, en escritorio y en móvil. Vive
 * suelto y no dentro de ese componente porque el matiz de abajo —salir igual si
 * la llamada falla— es fácil de perder al copiarlo a un segundo sitio.
 */
export function useSignOut() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = leaving || pending;

  /**
   * Le pide al service worker que tire las cachés con páginas de este usuario.
   *
   * El `router.refresh()` de abajo se ocupa del Router Cache, que vive en
   * memoria y muere con la pestaña. Las cachés del worker no: son de ORIGEN y
   * persisten en disco, así que sin esto el siguiente usuario de este navegador
   * podría leer sin red los Proyectos del anterior. Quien borra es el worker
   * —las cachés son suyas—; aquí solo se avisa.
   *
   * No se espera la respuesta ni se bloquea la salida: si no hay worker (primer
   * arranque, navegador sin soporte, modo incógnito) tampoco hay nada guardado
   * que borrar, y dejar al usuario atrapado en una ruta protegida por un
   * mensaje que nadie escucha sería el peor cambio posible.
   */
  function askWorkerToForget() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.controller?.postMessage({ type: SIGN_OUT_MESSAGE });
  }

  async function signOut() {
    if (busy) return;
    setLeaving(true);
    try {
      await getBackend().auth.signOut();
    } finally {
      askWorkerToForget();
      // Se sale igual si `signOut` falla: la cookie puede haber caducado ya, y
      // dejar al usuario mirando una ruta protegida de la que no puede salir es
      // peor que mandarlo a la landing. Quien decide de verdad es `proxy.ts` en
      // la siguiente petición.
      //
      // `refresh` antes de navegar: sin él el Router Cache podría servir la
      // versión ya renderizada de esta página, con el email todavía dentro.
      startTransition(() => {
        router.refresh();
        router.replace(ROUTES.home);
      });
    }
  }

  return { signOut, busy };
}
