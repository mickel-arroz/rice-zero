"use client";

import Link from "next/link";
import { useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { PlusIcon } from "@/components/icons/plus-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import { useProjects } from "@/components/projects/projects-provider";
import { DeleteNodeDialog } from "@/components/registro/delete-node-dialog";
import { INDENT, ROW_HEIGHT, NodeRow } from "@/components/registro/node-row";
import { NodeActions } from "@/components/registro/node-actions";
import { useRegistro } from "@/components/registro/registro-provider";
import { ReparentDialog } from "@/components/registro/reparent-dialog";
import { REGISTRO_COPY, ROUTES } from "@/lib/constants";

/**
 * La Vista Registro: el árbol de la Versión abierta, editable solo con botones.
 *
 * Aquí no hay lógica de árbol. La estructura la calcula `lib/tree/outline`, las
 * escrituras las hace `RegistroProvider` y las reglas viven en `lib/tree`; esta
 * pantalla decide QUÉ se enseña en cada estado y nada más. Es lo que permite
 * que la Vista Canvas (#12) reutilice todo lo de abajo sin heredar nada de esto.
 */

/**
 * Lanza una escritura sin esperarla.
 *
 * El `catch` vacío NO se traga el fallo: `RegistroProvider` ya lo dejó en su
 * estado y la cabecera lo está enseñando con su frase. Lo que se traga es el
 * rechazo de la promesa, que sin esto llegaría a la consola como un error sin
 * dueño — el provider la relanza a propósito para que los diálogos sepan que
 * no deben cerrarse, y aquí no hay ningún diálogo esperando.
 */
function fire(work: Promise<unknown>): void {
  void work.catch(() => {});
}

/** La silueta de una fila mientras el árbol viaja. Con su sangría, para que la
 *  forma que aparece sea la forma que se queda. */
function RowSkeleton({ depth }: { depth: number }) {
  return (
    <li className="flex items-stretch" style={{ height: ROW_HEIGHT }}>
      <span className="shrink-0" style={{ width: (depth + 1) * INDENT }} />
      <span className="my-1 flex-1 rounded-2xl bg-accent" />
    </li>
  );
}

/** Qué diálogo hay delante, si hay alguno. */
type Overlay = { kind: "move" | "delete"; id: string } | null;

export function RegistroScreen({ projectId }: { projectId: string }) {
  const { projects, status: projectsStatus } = useProjects();
  const registro = useRegistro();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const project = projects.find((candidate) => candidate.id === projectId) ?? null;
  const selected =
    registro.rows.find((row) => row.node.id === registro.selectedId) ?? null;

  // El diálogo se busca en el árbol vivo, no se guarda una copia: así un Nodo
  // que desaparece mientras está abierto lo cierra solo, en vez de dejarlo
  // enseñando algo que ya no existe. Mismo criterio que en `ProjectsScreen`.
  const target = overlay
    ? (registro.nodes.find((node) => node.id === overlay.id) ?? null)
    : null;

  return (
    // El `max-w` NO va en el `main`: la barra de acciones es hija suya y en
    // escritorio es una pastilla ancha que se centra en toda la columna. Con el
    // límite aquí, la pastilla lo desbordaba y metía scroll horizontal en la
    // página entera. El ancho de lectura se lo pone la columna de dentro.
    <main className="flex flex-1 flex-col px-6 py-6 lg:px-16 lg:py-10">
      <div className="flex flex-1 flex-col lg:mx-auto lg:w-full lg:max-w-3xl">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={ROUTES.projects}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <ChevronLeftIcon width={16} height={16} />
            {REGISTRO_COPY.back}
          </Link>
          <SaveState />
        </div>

        <p className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <span className={LABEL_CLASS}>{REGISTRO_COPY.label}</span>
        </p>

        {project ? (
          <h1 className="text-[29px] leading-none tracking-[0.02em] lg:text-5xl">
            {project.title}
          </h1>
        ) : (
          // Mientras la lista de Proyectos viaja no se inventa un título: se
          // deja su hueco, del alto que va a ocupar.
          <span
            className="w-52 rounded-lg bg-accent"
            style={{ height: 29 }}
            aria-hidden={projectsStatus === "loading"}
          />
        )}

        {registro.version ? (
          <p className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-6.5 items-center rounded-full border border-border px-2.5 text-[11px] tracking-[0.1em] uppercase">
              {REGISTRO_COPY.versionChip(registro.version.versionNumber)}
            </span>
            <span className="text-xs text-muted-foreground">
              {REGISTRO_COPY.versionName(
                registro.version.versionNumber,
                registro.version.label,
              )}{" "}
              · {REGISTRO_COPY.nodeCount(registro.nodes.length)}
            </span>
          </p>
        ) : null}
      </header>

      <div className="mt-5 flex flex-1 flex-col">
        {registro.status === "loading" ? (
          <ul aria-busy="true" aria-label={REGISTRO_COPY.loading} className="flex flex-col">
            {[0, 1, 2, 2, 1, 0].map((depth, index) => (
              <RowSkeleton key={index} depth={depth} />
            ))}
          </ul>
        ) : null}

        {registro.status === "error" ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-border bg-card p-7"
          >
            <AlertIcon width={28} height={28} className="text-primary" />
            <p className="text-center text-[15px] font-bold text-pretty">
              {REGISTRO_COPY.errorTitle}
            </p>
            <p className="max-w-[258px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
              {registro.error ?? REGISTRO_COPY.errorBody}
            </p>
            <button
              type="button"
              onClick={() => fire(registro.reload())}
              className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
            >
              {REGISTRO_COPY.retry}
            </button>
          </div>
        ) : null}

        {registro.status === "ready" && registro.rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-dashed border-border p-6">
            <span className="font-display text-[15px] text-primary">00</span>
            <p className="text-[15px] font-bold">{REGISTRO_COPY.emptyTitle}</p>
            <p className="max-w-[250px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
              {REGISTRO_COPY.emptyBody}
            </p>
            <button
              type="button"
              onClick={() => fire(registro.createRoot())}
              className={`${CTA_PRIMARY_CLASS} px-6`}
            >
              <PlusIcon />
              {REGISTRO_COPY.firstNode}
            </button>
          </div>
        ) : null}

        {registro.status === "ready" && registro.rows.length > 0 ? (
          <>
            <ul className="flex flex-col">
              {registro.rows.map((row) => (
                <NodeRow
                  key={row.node.id}
                  row={row}
                  selected={registro.selectedId === row.node.id}
                  editing={registro.editingId === row.node.id}
                  text={registro.textOf(row.node)}
                  onSelect={() => registro.select(row.node.id)}
                  onEdit={() => registro.startEditing(row.node.id)}
                  onChange={(value) => registro.setText(row.node.id, value)}
                  onStopEditing={registro.stopEditing}
                />
              ))}
            </ul>

            {/* Al final de la lista y no en la cabecera: una raíz nueva se pone
                la última, así que el botón está donde va a aparecer. */}
            <button
              type="button"
              onClick={() => fire(registro.createRoot())}
              className="mt-1.5 flex h-12.5 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <PlusIcon width={16} height={16} />
              {REGISTRO_COPY.newRoot}
            </button>
          </>
        ) : null}
      </div>
      </div>

      {selected ? (
        <NodeActions
          row={selected}
          onMove={() => setOverlay({ kind: "move", id: selected.node.id })}
          onDelete={() => setOverlay({ kind: "delete", id: selected.node.id })}
        />
      ) : null}

      {overlay?.kind === "move" && target ? (
        <ReparentDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
      {overlay?.kind === "delete" && target ? (
        <DeleteNodeDialog node={target} onClose={() => setOverlay(null)} />
      ) : null}
    </main>
  );
}

/**
 * El pie del Autoguardado: lo único que le dice al usuario que no hay botón.
 *
 * Tres estados y no dos: «guardado» tranquiliza, «guardando» explica el
 * parpadeo, y el fallo tiene que decir QUÉ pasó — un icono rojo sin frase deja
 * a la persona sin saber si perdió lo que acaba de escribir.
 */
function SaveState() {
  const { save, saveError } = useRegistro();

  if (save === "error") {
    return (
      <span
        role="alert"
        className="flex items-center gap-1.5 text-right text-[10px] tracking-[0.06em] text-primary"
      >
        <AlertIcon width={14} height={14} className="shrink-0" />
        {saveError ?? REGISTRO_COPY.saveFailed}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
      {save === "saving" ? (
        <>
          <span aria-hidden="true" className="size-[7px] rounded-full bg-primary" />
          {REGISTRO_COPY.saving}
        </>
      ) : (
        <>
          <CheckIcon width={14} height={14} />
          {REGISTRO_COPY.saved}
        </>
      )}
    </span>
  );
}
