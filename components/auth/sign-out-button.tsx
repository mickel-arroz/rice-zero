"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LogoutIcon } from "@/components/icons/logout-icon";
import { CTA_SECONDARY_CLASS } from "@/components/layout/site-chrome";
import { getBackend } from "@/lib/backend";
import { PROJECTS_COPY, ROUTES } from "@/lib/constants";

export function SignOutButton() {
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

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      aria-busy={busy}
      className={`${CTA_SECONDARY_CLASS} ${busy ? "opacity-45" : ""}`}
    >
      <LogoutIcon />
      {busy ? PROJECTS_COPY.signingOut : PROJECTS_COPY.signOut}
    </button>
  );
}
