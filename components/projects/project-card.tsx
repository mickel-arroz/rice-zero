"use client";

import { useEffect, useRef, useState } from "react";

import { AnalysesIcon } from "@/components/icons/analyses-icon";
import { MoreIcon } from "@/components/icons/more-icon";
import { NodesIcon } from "@/components/icons/nodes-icon";
import { PencilIcon } from "@/components/icons/pencil-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import { VersionsIcon } from "@/components/icons/versions-icon";
import type { IconComponent } from "@/components/icons/types";
import type { ProjectOverview } from "@/lib/backend/ports";
import { CONNECTION_COPY, PROJECTS_COPY } from "@/lib/constants";
import { relativeTime } from "@/lib/time";

/**
 * Una métrica del pie: la cifra en `--foreground` sobre la etiqueta en
 * versalitas. El icono es de 14 px, un escalón por debajo del icono asignado.
 */
function Metric({
  icon: Icon,
  count,
  label,
}: {
  icon: IconComponent;
  count: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon width={14} height={14} className="shrink-0 text-muted-foreground" />
      <span className="text-[10px] whitespace-nowrap uppercase tracking-[0.1em] text-muted-foreground">
        <span className="font-bold text-foreground">{count}</span> {label}
      </span>
    </span>
  );
}

/**
 * La tarjeta de un Proyecto.
 *
 * Dos reglas de layout que parecen detalles y no lo son:
 *
 *   · **No lleva `self-start` ni la rejilla `items-start`.** CSS Grid estira
 *     por defecto, y eso es exactamente lo que se quiere: todas las tarjetas de
 *     una fila miden lo que la más alta de ESA fila. Escribir el `start` fue lo
 *     que rompió la primera versión del boceto.
 *   · **El pie va con `mt-auto`.** Así el hueco sobrante cae en medio de las
 *     tarjetas de descripción corta y nunca por debajo del pie, de modo que los
 *     pies de una fila quedan siempre a la misma altura.
 */
export function ProjectCard({
  project,
  icon: Icon,
  now,
  blocked,
  onEdit,
  onDelete,
}: {
  project: ProjectOverview;
  /**
   * El icono asignado, ya resuelto.
   *
   * Llega hecho y no se resuelve aquí por lo mismo que en `NavRow`: un
   * componente que sale de una llamada dentro del cuerpo de otro es
   * indistinguible de uno declarado al vuelo, que perdería su estado en cada
   * repintado. Quien lo resuelve es quien pinta la lista, con `projectIconFor`.
   */
  icon: IconComponent;
  /** El mismo instante para toda la lista: ver `relativeTime`. */
  now: Date;
  /**
   * Sin conexión. La tarjeta se lee entera; lo único que se apaga es el menú
   * de tres puntos, que es todo lo que esta tarjeta puede escribir.
   *
   * Llega como prop y no de `useBlocked()` por lo mismo que en `NodeRow`: la
   * tarjeta recibe de fuera todo lo demás que decide qué pinta.
   */
  blocked: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function act(action: () => void) {
    setOpen(false);
    action();
  }

  /**
   * Las flechas recorren el menú, como en cualquier menú.
   *
   * Declarar `role="menu"` y no moverse con flechas es anunciarle a un lector
   * de pantalla algo que luego no se cumple. Son dos entradas, así que arriba y
   * abajo hacen lo mismo: ir a la otra.
   */
  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  return (
    <article className="relative flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <Icon width={22} height={22} className="shrink-0 text-primary" />
        <span className="flex-1" />
        <time
          dateTime={project.lastActivityAt.toISOString()}
          className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {relativeTime(project.lastActivityAt, now)}
        </time>

        <div ref={menu} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            disabled={blocked}
            title={blocked ? CONNECTION_COPY.blocked : undefined}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={PROJECTS_COPY.actions(project.title)}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-35 ${
              open
                ? "border-primary bg-accent text-primary"
                : `border-transparent text-muted-foreground ${
                    blocked ? "" : "hover:border-border hover:text-primary"
                  }`
            }`}
          >
            <MoreIcon width={18} height={18} />
          </button>

          {open ? (
            <div
              role="menu"
              onKeyDown={onMenuKeyDown}
              className="absolute top-11 right-0 z-20 flex w-44 flex-col gap-0.5 rounded-[20px] border border-border bg-card p-1.5 shadow-popover"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => act(onEdit)}
                className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm transition-colors hover:bg-accent hover:text-primary"
              >
                <PencilIcon width={18} height={18} />
                {PROJECTS_COPY.edit}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => act(onDelete)}
                className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm text-primary transition-colors hover:bg-accent"
              >
                <TrashIcon width={18} height={18} />
                {PROJECTS_COPY.delete}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-[17px] font-bold">{project.title}</h2>
        {project.description ? (
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex items-center gap-3 border-t border-border pt-3">
        <Metric
          icon={VersionsIcon}
          count={project.versionCount}
          label={PROJECTS_COPY.versions(project.versionCount)}
        />
        <Metric
          icon={NodesIcon}
          count={project.nodeCount}
          label={PROJECTS_COPY.nodes(project.nodeCount)}
        />
        {/* Se oculta en cero: un «0 Análisis» en cada tarjeta nueva es ruido, y
            lo que se quiere ver de un vistazo es cuáles ya dieron prompts. */}
        {project.analysisCount > 0 ? (
          <Metric
            icon={AnalysesIcon}
            count={project.analysisCount}
            label={PROJECTS_COPY.analyses}
          />
        ) : null}
      </div>
    </article>
  );
}
