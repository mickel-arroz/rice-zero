"use client";

import { useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { NodesIcon } from "@/components/icons/nodes-icon";
import { CTA_SECONDARY_CLASS } from "@/components/layout/site-chrome";
import { ProposalDialog } from "@/components/proposal/proposal-dialog";
import { CONNECTION_COPY, PROPOSAL_COPY } from "@/lib/constants";

/**
 * La puerta de la Propuesta de Nodos. Solo la monta la Vista Registro.
 *
 * Solo allí porque es la vista de edición —en el teléfono, la única— y porque
 * lo que trae la Propuesta entra al final de la lista, que es donde está el
 * botón. El Canvas no la tiene: no la pide el ticket, y en móvil es de solo
 * consulta.
 *
 * `row`  — al lado de «Nodo raíz», con su mismo borde punteado (el boceto).
 * `cta`  — en el estado vacío, debajo de «Primer Nodo»: una Versión sin nada
 *          es justo donde más sirve pedirle a la IA las primeras ramas.
 */
export function ProposeButton({ look }: { look: "row" | "cta" }) {
  const [open, setOpen] = useState(false);
  const blocked = useBlocked();

  const className =
    look === "row"
      ? `flex h-12.5 shrink-0 items-center gap-2 rounded-2xl border border-dashed border-primary px-4.5 text-[13px] text-primary transition-opacity disabled:opacity-35 ${
          blocked ? "" : "hover:opacity-80"
        }`
      : `${CTA_SECONDARY_CLASS} px-6 disabled:opacity-35`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
        className={className}
      >
        <NodesIcon width={16} height={16} />
        {PROPOSAL_COPY.open}
      </button>
      {open ? <ProposalDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
