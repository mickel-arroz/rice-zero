"use client";

import { useBlocked } from "@/components/connection/connection-provider";
import { useProjects } from "@/components/projects/projects-provider";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { ProjectOverview } from "@/lib/backend/ports";
import { PROJECTS_COPY } from "@/lib/constants";

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
 *
 * Es el único de los cuatro borrados que va SIN el recuadro de la cifra, y por
 * eso no le pasa `figure` a `ConfirmDeleteDialog`: lo que se lleva no es una
 * cantidad sino tres, y tres cifras no caben en un recuadro pensado para una.
 * Se enumeran en negrita dentro del cuerpo.
 */
export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: ProjectOverview;
  onClose: () => void;
}) {
  const { remove } = useProjects();
  const blocked = useBlocked();

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

  return (
    <ConfirmDeleteDialog
      label={PROJECTS_COPY.delete}
      title={PROJECTS_COPY.deleteTitle(project.title)}
      closeLabel={PROJECTS_COPY.close}
      body={
        <>
          {PROJECTS_COPY.deleteCounts}{" "}
          {losses.map((loss, index) => (
            <span key={loss}>
              {index > 0 ? (index === losses.length - 1 ? " y " : ", ") : ""}
              <span className="font-bold text-foreground">{loss}</span>
            </span>
          ))}
          . {PROJECTS_COPY.deleteBody}
        </>
      }
      submitLabel={PROJECTS_COPY.delete}
      pendingLabel={PROJECTS_COPY.deleting}
      cancelLabel={PROJECTS_COPY.cancel}
      blocked={blocked}
      onConfirm={() => remove(project.id)}
      onClose={onClose}
    />
  );
}
