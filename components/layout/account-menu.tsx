"use client";

import { useEffect, useRef, useState } from "react";

import { LogoutIcon } from "@/components/icons/logout-icon";
import { Avatar } from "@/components/ui/avatar";
import { useSignOut } from "@/components/auth/use-sign-out";
import { LABEL_CLASS } from "@/components/layout/site-chrome";
import { PROJECTS_COPY, SHELL_COPY } from "@/lib/constants";

/**
 * La cuenta, en una fila y un desplegable.
 *
 * Es una sola fila y no un bloque de dos líneas más otra de cerrar sesión
 * porque el bloque medía distinto plegado que desplegado, y eso desplazaba
 * verticalmente todo lo que tenía encima al colapsar la sidebar. Con una fila
 * de alto fijo, plegar solo cambia el ancho: ninguna otra cosa se mueve.
 *
 * El desplegable funciona en los dos estados, no solo plegado: quien lo aprende
 * en uno lo encuentra en el otro.
 */
export function AccountMenu({
  email,
  name,
  image,
  collapsed,
  height,
}: {
  email: string;
  name: string | null;
  image: string | null;
  collapsed: boolean;
  height: number;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { signOut, busy } = useSignOut();

  // Cerrar al pulsar fuera y con Escape. Un desplegable que solo se cierra con
  // su propio botón se queda abierto en cuanto el usuario mira a otro lado.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = name ?? email;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={collapsed ? SHELL_COPY.account : undefined}
        title={collapsed ? label : undefined}
        className="flex w-full items-center gap-2.5 rounded-full px-4 text-left transition-colors hover:text-primary"
        style={{ height: `${height}px` }}
      >
        {/* La ranura de 20 px es la misma que ocupa un icono, así que el avatar
            cae exactamente sobre el mismo eje vertical que el resto de filas y
            no se desplaza al plegar. El avatar rebosa la ranura por igual a los
            dos lados. */}
        <span className="flex w-5 shrink-0 items-center justify-center">
          <Avatar src={image} name={label} size={26} />
        </span>
        {/* UNA línea, con el mismo tamaño de texto que cualquier otra fila: el
            email completo y la etiqueta «Sesión activa» ocupaban dos, y esa
            altura extra era lo único que rompía la simetría con el estado
            plegado. El detalle vive en el desplegable, que es donde se pide. */}
        {collapsed ? null : (
          <span className="min-w-0 flex-1 truncate text-[15px] tracking-[0.01em]">
            {label}
          </span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          // Hacia arriba: la fila vive al fondo de la sidebar, así que abajo no
          // hay sitio. Plegada, el panel desborda la columna a la derecha — que
          // es justo lo que se espera de un raíl de 76 px.
          className="absolute bottom-full left-0 z-20 mb-2 flex w-58 flex-col gap-3 rounded-[20px] border border-border bg-card p-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <Avatar src={image} name={label} size={40} />
            <span className="flex min-w-0 flex-col">
              {name ? (
                <span className="truncate text-sm font-bold">{name}</span>
              ) : null}
              <span className="truncate text-xs text-muted-foreground">
                {email}
              </span>
            </span>
          </div>

          <span className={LABEL_CLASS}>{PROJECTS_COPY.verified}</span>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={busy}
            aria-busy={busy}
            className={`flex h-11 items-center gap-2.5 rounded-full border border-border px-4 text-[13px] font-bold transition-colors hover:border-primary hover:text-primary ${
              busy ? "opacity-45" : ""
            }`}
          >
            <LogoutIcon width={18} height={18} />
            {busy ? PROJECTS_COPY.signingOut : SHELL_COPY.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
