"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import {
  DEFAULT_PROJECT_ICON,
  isProjectIconKey,
  type ProjectIconKey,
} from "@/components/icons/projects";
import { planAutosave, type ProjectDraft } from "@/components/projects/autosave";
import { Field } from "@/components/projects/field";
import { IconPicker } from "@/components/projects/icon-picker";
import { useProjects } from "@/components/projects/projects-provider";
import { CTA_SECONDARY_CLASS } from "@/components/layout/site-chrome";
import { Dialog } from "@/components/ui/dialog";
import type { ProjectOverview } from "@/lib/backend/ports";
import { CONNECTION_COPY, PROJECTS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { PROJECT_LIMITS } from "@/lib/services/projects";

/**
 * Cuánto se espera antes de escribir lo que se está tecleando.
 *
 * Ni cero ni mucho. A cero, cada tecla sería una petición; a un segundo, quien
 * escribe una frase y cierra el diálogo perdería la última palabra. Medio
 * segundo es la pausa natural entre palabras.
 *
 * El icono NO pasa por aquí: elegirlo es una decisión terminada, no una a
 * medias, así que se escribe en el momento.
 */
const TYPING_DELAY = 500;

/**
 * Editar un Proyecto.
 *
 * **Sin botón de guardar**, y no por descuido: «todo cambio mínimo se persiste
 * de inmediato; no existe botón guardar» es la regla de Autoguardado del
 * `CONTEXT.md`. El pie dice en qué estado está la escritura y «Listo» solo
 * cierra — para cuando se cierra, ya está todo guardado.
 *
 * Qué se guarda y cuándo lo decide `planAutosave`, que es una función pura y
 * vive aparte. Aquí solo queda el cableado: el rebote, el estado del pie y el
 * vuelco al desmontar, que es lo que evita perder las últimas letras de quien
 * cierra sin esperar.
 */
export function EditProjectDialog({
  project,
  onClose,
}: {
  project: ProjectOverview;
  onClose: () => void;
}) {
  const { update } = useProjects();
  const blocked = useBlocked();

  const initial: ProjectDraft = {
    title: project.title,
    description: project.description ?? "",
    // Una clave desconocida —de una versión anterior de la app— no puede dejar
    // el selector sin nada marcado: cae al icono por defecto, igual que la
    // tarjeta.
    icon: isProjectIconKey(project.icon) ? project.icon : DEFAULT_PROJECT_ICON,
  };

  const [draft, setDraft] = useState<ProjectDraft>(initial);
  const [status, setStatus] = useState<
    "clean" | "saving" | "saved" | "error" | "pending"
  >("clean");
  const [error, setError] = useState<string | null>(null);

  // Lo último que el motor confirmó. En una ref y no en estado porque cambiarlo
  // no tiene que repintar nada: es el punto de comparación del rebote, no algo
  // que se dibuje.
  const saved = useRef<ProjectDraft>(initial);

  /**
   * Escribe lo que haya que escribir. `silent` para el vuelco final.
   *
   * Sin tocar el estado cuando es silencioso porque ese camino corre al
   * DESMONTAR: el diálogo ya no está, así que no hay pie que actualizar ni
   * error que enseñar — solo una escritura que tiene que salir igual.
   */
  const persist = useCallback(
    async (next: ProjectDraft, silent = false) => {
      const plan = planAutosave(next, saved.current);

      if (plan.kind === "idle") return;
      if (plan.kind === "invalid") {
        // Al cerrar con el título a medias no se escribe nada, y es lo correcto:
        // un Proyecto sin título no existe. El error ya estaba a la vista.
        if (silent) return;
        setStatus("error");
        setError(plan.message);
        return;
      }

      if (!silent) {
        setStatus("saving");
        setError(null);
      }
      try {
        await update(project.id, plan.patch);
        saved.current = next;
        if (!silent) setStatus("saved");
      } catch (cause) {
        if (silent) return;
        setStatus("error");
        setError(errorMessage(cause));
      }
    },
    [project.id, update],
  );

  // El rebote del texto. Depende del borrador entero y no solo del texto para
  // que el `patch` que se manda incluya lo que haya cambiado mientras tanto.
  //
  // Sin red no se programa nada: lo tecleado se RETIENE. Y como `blocked` es
  // una dependencia, al volver la conexión este mismo efecto vuelve a correr y
  // suelta lo retenido sin que nadie pulse — que es lo que hace que «ninguna
  // mutación se pierde» valga también aquí dentro. No hace falta un mecanismo
  // aparte como el de `TreeProvider` porque este rebote ya se reprograma solo.
  useEffect(() => {
    if (blocked) {
      // Solo si de verdad hay algo esperando: decir «Pendiente» sobre un
      // diálogo que nadie tocó sería inventarse un cambio.
      if (planAutosave(draft, saved.current).kind !== "idle") setStatus("pending");
      return;
    }
    const timer = setTimeout(() => void persist(draft), TYPING_DELAY);
    return () => clearTimeout(timer);
  }, [draft, persist, blocked]);

  // El borrador vigente, para poder leerlo desde el desmontaje sin que el
  // efecto de abajo dependa de él — si dependiera, se «desmontaría» en cada
  // tecla y volcaría a mitad de palabra. Se copia en un efecto y no durante el
  // render: escribir una ref mientras se pinta es lo que React prohíbe.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  /**
   * El vuelco final: al cerrar se escribe lo que el rebote aún no había escrito.
   *
   * Sin esto, cerrar el diálogo antes de medio segundo desde la última tecla
   * PERDÍA esas letras — la limpieza del efecto de arriba cancela el temporizador
   * y no había nada detrás que lo recogiera. Es justo lo que el Autoguardado
   * promete que no pasa: «todo cambio mínimo se persiste de inmediato».
   *
   * `persist` es estable, así que este efecto solo se limpia al desmontar.
   */
  useEffect(() => {
    return () => {
      void persist(latest.current, true);
    };
  }, [persist]);

  function chooseIcon(icon: ProjectIconKey) {
    const next = { ...draft, icon };
    setDraft(next);
    // Sin esperar al rebote: elegir un icono ya es la decisión completa.
    void persist(next);
  }

  const footerText =
    status === "saving"
      ? PROJECTS_COPY.saving
      : status === "pending"
        ? CONNECTION_COPY.savePending
        : status === "saved"
          ? PROJECTS_COPY.saved
          : null;

  return (
    <Dialog
      label={PROJECTS_COPY.editLabel}
      title={PROJECTS_COPY.editTitle}
      onClose={onClose}
      closeLabel={PROJECTS_COPY.close}
      footer={
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <p
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {status === "error" ? (
              <>
                <AlertIcon width={16} height={16} className="shrink-0 text-primary" />
                <span className="text-primary">{error}</span>
              </>
            ) : footerText ? (
              <>
                <CheckIcon
                  width={16}
                  height={16}
                  className={`shrink-0 text-primary ${status === "saving" ? "opacity-45" : ""}`}
                />
                {footerText}
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`${CTA_SECONDARY_CLASS} px-8`}
          >
            {PROJECTS_COPY.done}
          </button>
        </div>
      }
    >
      <Field
        label={PROJECTS_COPY.titleField}
        value={draft.title}
        onChange={(title) => setDraft((prev) => ({ ...prev, title }))}
        maxLength={PROJECT_LIMITS.titleMax}
        readOnly={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
        autoFocus
      />
      <Field
        label={PROJECTS_COPY.descriptionField}
        value={draft.description}
        onChange={(description) => setDraft((prev) => ({ ...prev, description }))}
        placeholder={PROJECTS_COPY.descriptionPlaceholder}
        maxLength={PROJECT_LIMITS.descriptionMax}
        rows={3}
        readOnly={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
      />
      {/* El icono sí se DESHABILITA y no se pone de solo lectura: no hay nada
          que copiar de una rejilla de botones. */}
      <IconPicker value={draft.icon} onChange={chooseIcon} disabled={blocked} />
    </Dialog>
  );
}
