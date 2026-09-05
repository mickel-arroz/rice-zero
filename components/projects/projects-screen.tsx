"use client";

import { useCallback, useEffect, useState } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import { projectIconFor } from "@/components/icons/projects";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { DeleteProjectDialog } from "@/components/projects/delete-project-dialog";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { useProjects } from "@/components/projects/projects-provider";
import { CONNECTION_COPY, PROJECTS_COPY } from "@/lib/constants";

/**
 * La rejilla, con las tres formas que puede tomar.
 *
 * `md:grid-cols-2` y `xl:grid-cols-3`, saltándose `lg` a propósito: en 1024 px
 * la sidebar ya se come 260, y tres columnas dejarían la tarjeta por debajo de
 * 210. Sin `items-start` — ver `ProjectCard` sobre por qué eso importa.
 */
const GRID_CLASS = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

/** La silueta de una tarjeta: la forma de lo que viene, sin fingir el dato. */
function CardSkeleton({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="size-[22px] rounded-lg bg-accent" />
        <span className="h-2.5 w-14 rounded-full bg-accent" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="h-4 w-1/2 rounded-full bg-accent" />
        {lines.map((width) => (
          <span key={width} className="h-3 rounded-full bg-accent" style={{ width }} />
        ))}
      </div>
      <div className="mt-auto flex gap-3 border-t border-border pt-3">
        <span className="h-2.5 w-[74px] rounded-full bg-accent" />
        <span className="h-2.5 w-16 rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** Qué diálogo hay delante, si hay alguno. */
type Overlay = { kind: "create" } | { kind: "edit" | "delete"; id: string } | null;

export function ProjectsScreen() {
  const { status, projects, error, reload } = useProjects();
  // Sin red no se crea, ni se edita, ni se borra. Reintentar la LECTURA sí
  // sigue disponible: consultar nunca se bloquea, y con la caché del service
  // worker delante puede incluso funcionar.
  const blocked = useBlocked();
  const [overlay, setOverlay] = useState<Overlay>(null);

  // Un solo «ahora» para toda la lista: con el reloj dentro de cada tarjeta,
  // dos filas de la misma lista podrían caer a lados distintos de un escalón y
  // decir «hace 59 min» y «hace 1 h» de dos Proyectos tocados a la vez.
  //
  // Y se refresca cada minuto, que es el escalón más fino que la lista pinta:
  // sin esto, una pestaña abierta toda la mañana seguiría diciendo «hace un
  // momento» de algo de hace tres horas.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // El diálogo se busca en la lista viva, no se guarda una copia: así el
  // borrado que llega mientras está abierto lo cierra solo en vez de dejarlo
  // enseñando un Proyecto que ya no existe.
  const target =
    overlay && overlay.kind !== "create"
      ? (projects.find((project) => project.id === overlay.id) ?? null)
      : null;

  // Estable a propósito: los diálogos la reciben como prop y la usan en un
  // efecto, así que una identidad nueva en cada repintado los hacía trabajar de
  // más. Ver el comentario de `Dialog`.
  const close = useCallback(() => setOverlay(null), []);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-16 lg:py-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            <span className={LABEL_CLASS}>{PROJECTS_COPY.label}</span>
          </p>
          <h1 className="text-4xl leading-none tracking-[0.02em] lg:text-[56px]">
            {PROJECTS_COPY.title}
          </h1>
        </div>

        {/* La lista vacía tiene su propia llamada dentro del recuadro, así que
            aquí arriba el botón sobra: dos «Nuevo proyecto» en la misma
            pantalla no dan a elegir nada. */}
        {status === "ready" && projects.length > 0 ? (
          <button
            type="button"
            onClick={() => setOverlay({ kind: "create" })}
            disabled={blocked}
            title={blocked ? CONNECTION_COPY.blocked : undefined}
            className={`${CTA_PRIMARY_CLASS} px-6 disabled:opacity-35`}
          >
            <PlusIcon />
            {PROJECTS_COPY.newProject}
          </button>
        ) : null}
      </div>

      {status === "loading" ? (
        <div className={GRID_CLASS} aria-busy="true" aria-label={PROJECTS_COPY.loading}>
          <CardSkeleton lines={["100%", "72%"]} />
          <CardSkeleton lines={["88%"]} />
          <CardSkeleton lines={["100%", "45%"]} />
        </div>
      ) : null}

      {status === "error" ? (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-border bg-card p-7"
        >
          <AlertIcon width={28} height={28} className="text-primary" />
          <p className="text-center text-[15px] font-bold text-pretty">
            {PROJECTS_COPY.errorTitle}
          </p>
          <p className="max-w-[258px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
            {error ?? PROJECTS_COPY.errorBody}
          </p>
          <button
            type="button"
            onClick={() => void reload()}
            className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
          >
            {PROJECTS_COPY.retry}
          </button>
        </div>
      ) : null}

      {status === "ready" && projects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-dashed border-border p-6">
          <span className="font-display text-[15px] text-primary">00</span>
          <p className="text-[15px] font-bold">{PROJECTS_COPY.emptyTitle}</p>
          <p className="max-w-[250px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
            {PROJECTS_COPY.emptyBody}
          </p>
          <button
            type="button"
            onClick={() => setOverlay({ kind: "create" })}
            disabled={blocked}
            title={blocked ? CONNECTION_COPY.blocked : undefined}
            className={`${CTA_PRIMARY_CLASS} px-6 disabled:opacity-35`}
          >
            <PlusIcon />
            {PROJECTS_COPY.newProject}
          </button>
        </div>
      ) : null}

      {status === "ready" && projects.length > 0 ? (
        <div className={GRID_CLASS}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              // Nunca lanza: una clave que no reconoce cae al icono por
              // defecto, así que una fila escrita por una versión anterior de
              // la app no puede tumbar la lista entera.
              icon={projectIconFor(project.icon)}
              now={now}
              blocked={blocked}
              onEdit={() => setOverlay({ kind: "edit", id: project.id })}
              onDelete={() => setOverlay({ kind: "delete", id: project.id })}
            />
          ))}
        </div>
      ) : null}

      {overlay?.kind === "create" ? <CreateProjectDialog onClose={close} /> : null}
      {overlay?.kind === "edit" && target ? (
        <EditProjectDialog project={target} onClose={close} />
      ) : null}
      {overlay?.kind === "delete" && target ? (
        <DeleteProjectDialog project={target} onClose={close} />
      ) : null}
    </main>
  );
}
