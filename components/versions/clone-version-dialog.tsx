"use client";

import { useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { CloneIcon } from "@/components/icons/clone-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { Field } from "@/components/projects/field";
import { Dialog } from "@/components/ui/dialog";
import { useNodeCount } from "@/components/versions/use-node-count";
import { useVersions } from "@/components/versions/versions-provider";
import type { ProjectVersion } from "@/lib/backend/ports";
import { VERSIONS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { VERSION_LIMITS } from "@/lib/services/versions";

/**
 * Clonar una Versión, diciendo lo que clonar significa aquí.
 *
 * Pide confirmación aunque no destruya nada, y ésa es la decisión: clonar crea
 * una línea PARALELA que ya no se puede volver a unir, y quien viene de git da
 * por supuesto lo contrario. El diálogo existe para poner una etiqueta —que es
 * lo único que distingue una Versión de otra a simple vista— y para decir las
 * dos cosas que el puerto promete y que se olvidan: que el clon es
 * independiente y que los Análisis no viajan con él.
 */
export function CloneVersionDialog({
  version,
  onClose,
}: {
  version: ProjectVersion;
  onClose: () => void;
}) {
  const versions = useVersions();
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const blocked = useBlocked();
  const [error, setError] = useState<string | null>(null);

  const nodes = useNodeCount(version.id);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await versions.clone(version.id, label);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={VERSIONS_COPY.clone}
      title={VERSIONS_COPY.cloneTitle(version.versionNumber)}
      onClose={onClose}
      closeLabel={VERSIONS_COPY.close}
    >
      <Field
        label={VERSIONS_COPY.labelField}
        value={label}
        onChange={setLabel}
        placeholder={VERSIONS_COPY.labelPlaceholder}
        maxLength={VERSION_LIMITS.labelMax}
        autoFocus
        disabled={pending}
      />

      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {/* La cifra solo aparece cuando se sabe: ver `useNodeCount`. La frase
            se sostiene sola sin ella. */}
        {nodes === null ? null : (
          <>
            <span className="font-bold text-foreground">
              {VERSIONS_COPY.cloneNodes(nodes)}
            </span>
            .{" "}
          </>
        )}
        {VERSIONS_COPY.cloneBody}
      </p>

      <p className="flex gap-2 text-[13px] leading-relaxed text-pretty text-muted-foreground">
        <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
        {VERSIONS_COPY.cloneAnalyses}
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
          <CloneIcon width={18} height={18} />
          {pending ? VERSIONS_COPY.cloning : VERSIONS_COPY.cloneSubmit}
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
