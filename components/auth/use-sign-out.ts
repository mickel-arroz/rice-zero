"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getBackend } from "@/lib/backend";
import { ROUTES } from "@/lib/constants";

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

  async function signOut() {
    if (busy) return;
    setLeaving(true);
    try {
      await getBackend().auth.signOut();
    } finally {
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
