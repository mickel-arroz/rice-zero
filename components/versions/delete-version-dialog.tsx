"use client";

import { useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import { useNodeCount } from "@/components/versions/use-node-count";
import { useVersions } from "@/components/versions/versions-provider";
import type { ProjectVersion } from "@/lib/backend/ports";
import { TREE_COPY, VERSIONS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";

/**
 * Borrar una Versión, con la cuenta de lo que se lleva por delante.
 *
 * La cifra grande no es adorno: el spec pide que al podar un Nodo la
 * confirmación diga cuántos descendientes caen, y una Versión se lleva por
 * cascada su árbol ENTERO. Decirlo en abstracto —«y todo su contenido»— deja a
 * la persona adivinando cuánto es «todo».
 *
 * Y dice también lo que NO se lleva. Un clon de esta Versión sobrevive intacto
 * —la migración pone su `source_version_id` a `null`, no lo borra—, y quien no
 * lo sepa puede estar a punto de no borrar nada por miedo a perder dos líneas
 * de trabajo en vez de una.
 */
export function DeleteVersionDialog({
  version,
  onClose,
}: {
  version: ProjectVersion;
  onClose: () => void;
}) {
  const versions = useVersions();
  const [pending, setPending] = useState(false);
  const blocked = useBlocked();
  const [error, setError] = useState<string | null>(null);

  const nodes = useNodeCount(version.id);

  /**
   * ¿Sobrevive algún clon suyo? Solo entonces hay a quien tranquilizar, y la
   * respuesta está en la lista que el provider ya tiene.
   */
  const hasClones = versions.versions.some(
    (candidate) => candidate.sourceVersionId === version.id,
  );

  const name = TREE_COPY.versionName(version.versionNumber, version.label);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await versions.remove(version.id);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={VERSIONS_COPY.delete}
      title={VERSIONS_COPY.deleteTitle(name)}
      onClose={onClose}
      closeLabel={VERSIONS_COPY.close}
    >
      {/* La cifra solo aparece cuando se sabe: ver `useNodeCount`.

          Enmarcada y centrada, no en línea con el texto: la NDot es una fuente
          de matriz de puntos y sus cifras ocupan bastante menos alto que su
          `font-size`, así que puesta al lado de una frase se queda flotando en
          un hueco. Es el mismo recuadro de 72 px que ya usa la confirmación de
          podar un Nodo, que es de donde viene esta pantalla. */}
      {nodes === null ? null : (
        <div className="flex items-center gap-4 rounded-[18px] border border-border p-4">
          <div className="flex w-[72px] shrink-0 flex-col items-center gap-1">
            <span className="font-display text-[44px] leading-none text-primary">
              {nodes}
            </span>
            <span className="text-center text-[9px] tracking-[0.1em] text-muted-foreground uppercase">
              {VERSIONS_COPY.deleteFalls(nodes)}
            </span>
          </div>
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {VERSIONS_COPY.deleteSubtree}
          </p>
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {hasClones ? `${VERSIONS_COPY.deleteKeepsClones} ` : ""}
        {VERSIONS_COPY.deleteBody}
      </p>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-[13px] leading-relaxed text-primary"
        >
          <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-2.5 pt-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={confirm}
          // La conexión se cayó con el diálogo delante. Ver `CreateProjectDialog`.
          disabled={pending || blocked}
          className={`${CTA_PRIMARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          <TrashIcon width={18} height={18} />
          {pending ? VERSIONS_COPY.deleting : VERSIONS_COPY.deleteSubmit}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${CTA_SECONDARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          {VERSIONS_COPY.cancel}
        </button>
      </div>
    </Dialog>
  );
}
