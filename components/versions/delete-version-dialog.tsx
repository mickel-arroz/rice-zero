"use client";

import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useNodeCount } from "@/components/versions/use-node-count";
import { useVersions } from "@/components/versions/versions-provider";
import type { ProjectVersion } from "@/lib/backend/ports";
import { TREE_COPY, VERSIONS_COPY } from "@/lib/constants";

/**
 * Borrar una Versión, con la cuenta de lo que se lleva por delante.
 *
 * La anatomía —la cifra, el fallo que no cierra, el primario que se apaga sin
 * red— la pone `ConfirmDeleteDialog`. Aquí queda lo que solo sabe una Versión:
 * cuántos Nodos caen, y a quién hay que tranquilizar.
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

  // La cifra solo aparece cuando se sabe: ver `useNodeCount`.
  const nodes = useNodeCount(version.id);

  /**
   * ¿Sobrevive algún clon suyo? Solo entonces hay a quien tranquilizar, y la
   * respuesta está en la lista que el provider ya tiene.
   */
  const hasClones = versions.versions.some(
    (candidate) => candidate.sourceVersionId === version.id,
  );

  const name = TREE_COPY.versionName(version.versionNumber, version.label);

  return (
    <ConfirmDeleteDialog
      label={VERSIONS_COPY.delete}
      title={VERSIONS_COPY.deleteTitle(name)}
      closeLabel={VERSIONS_COPY.close}
      count={nodes}
      countLabel={VERSIONS_COPY.deleteFalls}
      detail={VERSIONS_COPY.deleteSubtree}
      body={
        <>
          {hasClones ? `${VERSIONS_COPY.deleteKeepsClones} ` : ""}
          {VERSIONS_COPY.deleteBody}
        </>
      }
      submitLabel={VERSIONS_COPY.deleteSubmit}
      pendingLabel={VERSIONS_COPY.deleting}
      cancelLabel={VERSIONS_COPY.cancel}
      onConfirm={() => versions.remove(version.id)}
      onClose={onClose}
    />
  );
}
