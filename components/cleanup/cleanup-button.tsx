"use client";

import { useMemo, useState } from "react";

import { CleanupDialog } from "@/components/cleanup/cleanup-dialog";
import { useBlocked } from "@/components/connection/connection-provider";
import { BroomIcon } from "@/components/icons/broom-icon";
import { useTree } from "@/components/tree/tree-provider";
import { CLEANUP_COPY, CONNECTION_COPY } from "@/lib/constants";
import { cleanupPlan } from "@/lib/tree/cleanup";

/**
 * La puerta de la Limpieza. Solo la monta la Vista Registro, que es la vista
 * de edición (ADR 0007), y actúa sobre el árbol de `useTree`: la Versión
 * abierta y ninguna otra.
 *
 * Con el plan vacío se queda APAGADO y no se esconde: un botón que aparece y
 * desaparece según lo que se marque como completado mueve a sus vecinos. Y
 * apagado no abre nunca un diálogo que borra cero (el boceto, artboard 4).
 *
 * La cifra del botón, la del diálogo y lo que se borra salen del MISMO plan,
 * calculado aquí una vez y pasado entero al diálogo.
 */
export function CleanupButton() {
  const [open, setOpen] = useState(false);
  const blocked = useBlocked();
  const { nodes } = useTree();
  const plan = useMemo(() => cleanupPlan(nodes), [nodes]);

  const empty = plan.total === 0;
  const disabled = blocked || empty;

  // El plan se vació con el diálogo abierto —se desmarcó algo, o se releyó—:
  // se cierra de verdad. Si solo se escondiera, marcar después un completado
  // lo volvería a abrir sin que nadie pulsara nada.
  if (open && empty) setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={empty ? CLEANUP_COPY.nothing : CLEANUP_COPY.openLabel(plan.total)}
        title={
          blocked ? CONNECTION_COPY.blocked : empty ? CLEANUP_COPY.nothing : undefined
        }
        className={`flex h-12.5 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-border px-3 text-[13px] text-muted-foreground transition-colors disabled:opacity-35 sm:px-4.5 ${
          disabled ? "" : "hover:border-primary hover:text-primary"
        }`}
      >
        <BroomIcon width={16} height={16} />
        {/* En el teléfono no caben los tres botones con texto: icono y cifra. */}
        <span className="hidden sm:inline">{CLEANUP_COPY.open}</span>
        {empty ? null : (
          <span className="font-display text-[15px] leading-none text-primary">
            {plan.total}
          </span>
        )}
      </button>
      {open ? (
        <CleanupDialog plan={plan} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
