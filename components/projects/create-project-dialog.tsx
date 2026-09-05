"use client";

import { useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import {
  DEFAULT_PROJECT_ICON,
  type ProjectIconKey,
} from "@/components/icons/projects";
import { Field } from "@/components/projects/field";
import { IconPicker } from "@/components/projects/icon-picker";
import { useProjects } from "@/components/projects/projects-provider";
import { CTA_PRIMARY_CLASS } from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import { CONNECTION_COPY, PROJECTS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { PROJECT_LIMITS } from "@/lib/services/projects";

/**
 * Dar de alta un Proyecto.
 *
 * Es la ÚNICA pantalla de Proyectos con botón de guardar, y tiene que serlo: el
 * Autoguardado persiste cambios sobre algo que ya existe, y aquí todavía no
 * existe nada. Por eso crear y editar no son el mismo diálogo aunque compartan
 * los tres campos.
 */
export function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const { create } = useProjects();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<ProjectIconKey>(DEFAULT_PROJECT_ICON);
  const [pending, setPending] = useState(false);
  const blocked = useBlocked();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !pending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    try {
      await create({ title, description, icon });
      onClose();
    } catch (cause) {
      // El diálogo NO se cierra al fallar: lo escrito sigue ahí y se puede
      // reintentar sin volver a teclearlo.
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <Dialog
      label={PROJECTS_COPY.createLabel}
      title={PROJECTS_COPY.newProject}
      onClose={onClose}
      closeLabel={PROJECTS_COPY.close}
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
        <Field
          label={PROJECTS_COPY.titleField}
          value={title}
          onChange={setTitle}
          placeholder={PROJECTS_COPY.titlePlaceholder}
          maxLength={PROJECT_LIMITS.titleMax}
          autoFocus
          disabled={pending}
        />
        <Field
          label={PROJECTS_COPY.descriptionField}
          value={description}
          onChange={setDescription}
          placeholder={PROJECTS_COPY.descriptionPlaceholder}
          maxLength={PROJECT_LIMITS.descriptionMax}
          rows={3}
          disabled={pending}
        />
        <IconPicker value={icon} onChange={setIcon} disabled={pending} />

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-[13px] leading-relaxed text-primary"
          >
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          // El disparador que abre este diálogo ya está apagado sin red, así
          // que aquí solo queda el caso de que la conexión se caiga con él
          // delante. Se apaga el botón en vez de cerrarlo: cerrarle a alguien
          // un diálogo en la cara se lee como que la app se rompió.
          disabled={!canSubmit || blocked}
          title={blocked ? CONNECTION_COPY.blocked : undefined}
          className={`${CTA_PRIMARY_CLASS} mt-auto disabled:opacity-45`}
        >
          <PlusIcon />
          {pending ? PROJECTS_COPY.creating : PROJECTS_COPY.createSubmit}
        </button>
      </form>
    </Dialog>
  );
}
