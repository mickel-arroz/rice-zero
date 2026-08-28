"use client";

import { useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import { useProjects } from "@/components/projects/projects-provider";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import type { ProjectOverview } from "@/lib/backend/ports";
import { PROJECTS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";

/**
 * Borrar un Proyecto, con la cuenta de lo que se lleva por delante.
 *
 * Las cifras no son adorno: el spec pide que al podar un Nodo la confirmación
 * diga cuántos descendientes caen, y un Proyecto se lleva por cascada sus
 * Versiones, sus Nodos y sus Análisis. Decirlo en abstracto —«y todo su
 * contenido»— deja al usuario adivinando cuánto es «todo».
 *
 * Las que ya están en la tarjeta, así que no cuesta ni una consulta: la lista
 * las trajo con el Proyecto.
 */
export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: ProjectOverview;
  onClose: () => void;
}) {
  const { remove } = useProjects();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Solo lo que hay: «0 Análisis» en la lista de bajas no informa de nada. */
  const losses = [
    `${project.versionCount} ${PROJECTS_COPY.versions(project.versionCount)}`,
    project.nodeCount > 0
      ? `${project.nodeCount} ${PROJECTS_COPY.nodes(project.nodeCount)}`
      : null,
    project.analysisCount > 0
      ? `${project.analysisCount} ${PROJECTS_COPY.analyses}`
      : null,
  ].filter((item): item is string => item !== null);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await remove(project.id);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={PROJECTS_COPY.delete}
      title={PROJECTS_COPY.deleteTitle(project.title)}
      onClose={onClose}
      closeLabel={PROJECTS_COPY.close}
    >
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {PROJECTS_COPY.deleteCounts}{" "}
        {losses.map((loss, index) => (
          <span key={loss}>
            {index > 0 ? (index === losses.length - 1 ? " y " : ", ") : ""}
            <span className="font-bold text-foreground">{loss}</span>
          </span>
        ))}
        . {PROJECTS_COPY.deleteBody}
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
          disabled={pending}
          className={`${CTA_PRIMARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          <TrashIcon width={18} height={18} />
          {pending ? PROJECTS_COPY.deleting : PROJECTS_COPY.delete}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={`${CTA_SECONDARY_CLASS} px-8 disabled:opacity-45 sm:flex-1`}
        >
          {PROJECTS_COPY.cancel}
        </button>
      </div>
    </Dialog>
  );
}
