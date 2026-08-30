"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { BlockedIcon } from "@/components/icons/blocked-icon";
import { ChevronDownIcon } from "@/components/icons/chevron-down-icon";
import { CloneIcon } from "@/components/icons/clone-icon";
import { MoreIcon } from "@/components/icons/more-icon";
import { PencilIcon } from "@/components/icons/pencil-icon";
import { TrashIcon } from "@/components/icons/trash-icon";
import { VersionsIcon } from "@/components/icons/versions-icon";
import { LABEL_CLASS } from "@/components/layout/site-chrome";
import { CloneVersionDialog } from "@/components/versions/clone-version-dialog";
import { DeleteVersionDialog } from "@/components/versions/delete-version-dialog";
import { useVersions } from "@/components/versions/versions-provider";
import type { ProjectVersion } from "@/lib/backend/ports";
import { LAST_VERSION_MESSAGE } from "@/lib/backend/ports";
import { ROUTES, TREE_COPY, VERSIONS_COPY } from "@/lib/constants";
import { relativeTime } from "@/lib/time";
import { VERSION_LIMITS } from "@/lib/services/versions";

/**
 * Qué Versión estás editando, y cómo cambiarla.
 *
 * Ocupa el sitio donde antes había una pastilla que solo decía «v7», y eso es
 * la decisión: la etiqueta que decía dónde estabas se convierte en el control
 * que lo cambia, exactamente el mismo movimiento que hizo `ViewSwitch` con el
 * marcador «Registro». Añadir un control más a una cabecera que ya tenía
 * cuatro cosas habría costado una fila entera de alto.
 *
 * El lenguaje visual es prestado, y a propósito: el disparador es la pastilla
 * de `ViewSwitch` (alto 32, redonda, borde, `--accent` + rojo al abrirse) y la
 * tarjeta flotante es la del menú de `ProjectCard` (radio 20, `--card`,
 * `shadow-popover`). Un dialecto nuevo en la misma cabecera sería un tercer
 * significado de «activo» que nadie pidió.
 */
export function VersionPicker({ projectId }: { projectId: string }) {
  const versions = useVersions();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  /** Qué fila tiene su menú de acciones abierto. Solo una a la vez. */
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  /** Qué fila está renombrándose en línea. Solo una a la vez. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [cloning, setCloning] = useState<ProjectVersion | null>(null);
  const [deleting, setDeleting] = useState<ProjectVersion | null>(null);

  /**
   * El instante contra el que se cuenta «hace 2 h», fijado al abrir.
   *
   * Uno solo para toda la lista: con el reloj por dentro de cada fila, dos
   * filas podrían caer a lados distintos del mismo escalón. Ver `relativeTime`.
   *
   * Se fija en el GESTO de abrir y no en un efecto sobre `open` porque un
   * `setState` en el cuerpo de un efecto encadena un render de más — y porque
   * `new Date()` durante el render sería un valor distinto en el servidor y en
   * el navegador, que es justo lo que hace saltar la hidratación.
   */
  const [now, setNow] = useState<Date | null>(null);

  // Se saca del objeto para que las dependencias sean estables: `versions` es
  // un valor nuevo en cada repintado del provider, `flushLabel` no.
  const { flushLabel } = versions;

  /**
   * Cierra el desplegable entero.
   *
   * Memoizado y no una función suelta porque el efecto de abajo depende de él:
   * una función recreada en cada render obligaría a suprimir la regla de
   * dependencias, y esa suppression sería la única del repo.
   */
  const close = useCallback(() => {
    setOpen(false);
    setActionsFor(null);
    setRenamingId(null);
    // Cerrar el desplegable es lo que hace una persona ANTES de tocar
    // cualquier otra cosa, así que ahí el medio segundo de rebote deja de ser
    // una comodidad y pasa a ser una ventana por la que se pierde una
    // etiqueta.
    void flushLabel();
  }, [flushLabel]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // El primer Escape cierra lo de encima —el menú de una fila, o el campo
      // de renombrar— y solo el segundo cierra el desplegable entero. Cerrarlo
      // todo de golpe se lleva por delante un gesto que la persona no pidió
      // deshacer.
      if (actionsFor || renamingId) {
        setActionsFor(null);
        setRenamingId(null);
        void flushLabel();
        return;
      }
      close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, actionsFor, renamingId, close, flushLabel]);

  const current = versions.current;

  // `VersionGate` no pinta esta cabecera hasta que hay Versión confirmada, así
  // que aquí `current` es siempre una, y lo que falta es cuando el gesto de
  // renombrar la deja fuera de la lista un instante. Se deja su hueco, del alto
  // que va a ocupar, igual que el título en `TreeHeader`.
  if (!current) {
    return (
      <span
        aria-label={VERSIONS_COPY.loading}
        className="block h-8 w-40 rounded-full bg-accent"
      />
    );
  }

  const name = TREE_COPY.versionName(current.versionNumber, current.label);

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setNow(new Date());
          setOpen(true);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={VERSIONS_COPY.open}
        className={`flex h-8 items-center gap-2 rounded-full border pr-2.5 pl-3.5 transition-colors ${
          open
            ? "border-primary bg-accent text-primary"
            : "border-border text-foreground hover:border-primary hover:text-primary"
        }`}
      >
        <span className="text-[11px] tracking-[0.1em] uppercase">
          {TREE_COPY.versionChip(current.versionNumber)}
        </span>
        <span aria-hidden="true" className="h-3.5 w-px bg-border" />
        <span className="max-w-40 truncate text-[13px] tracking-[0.01em] sm:max-w-64">
          {name}
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={VERSIONS_COPY.label}
          className="absolute top-10 left-0 z-30 flex w-[min(21.5rem,calc(100vw-3rem))] flex-col gap-0.5 rounded-[20px] border border-border bg-card p-1.5 shadow-popover"
        >
          <p className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5">
            <VersionsIcon width={14} height={14} className="text-muted-foreground" />
            <span className={LABEL_CLASS}>{VERSIONS_COPY.label}</span>
          </p>

          {versions.versions.map((version) => (
            <Row
              key={version.id}
              projectId={projectId}
              version={version}
              active={version.id === current.id}
              now={now}
              renaming={renamingId === version.id}
              actionsOpen={actionsFor === version.id}
              onOpenActions={() =>
                setActionsFor((id) => (id === version.id ? null : version.id))
              }
              onRename={() => {
                setActionsFor(null);
                setRenamingId(version.id);
              }}
              onStopRenaming={() => {
                setRenamingId(null);
                void flushLabel();
              }}
              onClone={() => {
                setActionsFor(null);
                setCloning(version);
              }}
              onDelete={() => {
                setActionsFor(null);
                setDeleting(version);
              }}
              onNavigate={close}
            />
          ))}

          <span aria-hidden="true" className="mx-2 my-1.5 h-px bg-border" />

          <button
            type="button"
            role="menuitem"
            onClick={() => setCloning(current)}
            className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm transition-colors hover:bg-accent hover:text-primary"
          >
            <CloneIcon width={18} height={18} />
            {VERSIONS_COPY.cloneCurrent}
          </button>
        </div>
      ) : null}

      {cloning ? (
        <CloneVersionDialog
          version={cloning}
          onClose={() => {
            setCloning(null);
            close();
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteVersionDialog
          version={deleting}
          onClose={() => {
            setDeleting(null);
            close();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Una Versión de la lista.
 *
 * La fila ENTERA es un enlace de verdad y no un `onClick`: así el botón
 * central, «abrir en otra pestaña» y copiar la dirección funcionan, que es la
 * mitad de por qué la Versión se metió en la URL.
 */
function Row({
  projectId,
  version,
  active,
  now,
  renaming,
  actionsOpen,
  onOpenActions,
  onRename,
  onStopRenaming,
  onClone,
  onDelete,
  onNavigate,
}: {
  projectId: string;
  version: ProjectVersion;
  active: boolean;
  /** El mismo instante para toda la lista, o `null` antes de montarse. */
  now: Date | null;
  renaming: boolean;
  actionsOpen: boolean;
  onOpenActions: () => void;
  onRename: () => void;
  onStopRenaming: () => void;
  onClone: () => void;
  onDelete: () => void;
  onNavigate: () => void;
}) {
  const versions = useVersions();
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) return;
    const el = field.current;
    if (!el) return;
    el.focus();
    // El cursor al final y no al principio: se entra a seguir escribiendo
    // mucho más a menudo que a corregir la primera palabra. Igual que en
    // `NodeRow`.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [renaming]);

  const name = TREE_COPY.versionName(version.versionNumber, version.label);

  /**
   * De dónde salió, si se sabe.
   *
   * El origen se busca en la lista y no se guarda su número en ningún sitio:
   * `sourceVersionId` es lo único que hay, y con la lista delante resolverlo es
   * un `find`. Cuando no está —porque el origen se borró y la migración puso
   * `null`— no se dice nada, en vez de llamarlo «original», que sería
   * inventarse una procedencia. Ver `VERSIONS_COPY.clonedFrom`.
   */
  const source = versions.versions.find(
    (candidate) => candidate.id === version.sourceVersionId,
  );

  const meta = [
    now ? relativeTime(version.createdAt, now) : null,
    source ? VERSIONS_COPY.clonedFrom(source.versionNumber) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <div
      className={`relative flex items-center gap-2.5 rounded-[14px] py-2 pr-2 pl-3 ${
        active ? "bg-accent" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${active ? "bg-primary" : ""}`}
      />

      {renaming ? (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            ref={field}
            type="text"
            value={versions.labelOf(version)}
            maxLength={VERSION_LIMITS.labelMax}
            placeholder={VERSIONS_COPY.labelPlaceholder}
            aria-label={VERSIONS_COPY.rename}
            onChange={(event) => versions.setLabel(version.id, event.target.value)}
            onBlur={onStopRenaming}
            onKeyDown={(event) => {
              if (event.key === "Enter") onStopRenaming();
            }}
            className="h-10 w-full rounded-xl border border-primary bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <SaveHint />
        </div>
      ) : (
        <Link
          href={ROUTES.version(projectId, version.id)}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 flex-col gap-0.5"
        >
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={`text-[11px] tracking-[0.1em] uppercase ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {TREE_COPY.versionChip(version.versionNumber)}
            </span>
            <span
              className={`truncate text-sm ${active ? "text-primary" : "text-foreground"}`}
            >
              {name}
            </span>
          </span>
          {/* Sin `meta` la línea desaparecería y la fila daría un salto al
              montarse el reloj, así que el hueco se reserva siempre. */}
          <span className="min-h-4 text-[11px] text-muted-foreground">{meta}</span>
        </Link>
      )}

      <button
        type="button"
        onClick={onOpenActions}
        aria-expanded={actionsOpen}
        aria-haspopup="menu"
        aria-label={VERSIONS_COPY.actions(name)}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
          actionsOpen
            ? "border-primary bg-card text-primary"
            : "border-transparent text-muted-foreground hover:border-border hover:text-primary"
        }`}
      >
        <MoreIcon width={18} height={18} />
      </button>

      {actionsOpen ? (
        <div
          role="menu"
          className="absolute top-12 right-2 z-40 flex w-60 flex-col gap-0.5 rounded-[20px] border border-border bg-card p-1.5 shadow-popover"
        >
          <ActionItem icon={<CloneIcon width={18} height={18} />} onClick={onClone}>
            {VERSIONS_COPY.clone}
          </ActionItem>
          <ActionItem icon={<PencilIcon width={18} height={18} />} onClick={onRename}>
            {VERSIONS_COPY.rename}
          </ActionItem>

          {versions.canDelete ? (
            <ActionItem
              icon={<TrashIcon width={18} height={18} />}
              onClick={onDelete}
              danger
            >
              {VERSIONS_COPY.delete}
            </ActionItem>
          ) : (
            <>
              {/* Se ENSEÑA deshabilitado y no se esconde: quitarlo de la lista
                  dejaría a la persona buscando una acción que desapareció sin
                  explicación, que es peor que un «no puedes» dicho a la cara.
                  Mismo criterio que los destinos bloqueados de «Mover a…». */}
              <span
                aria-disabled="true"
                className="flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm text-muted-foreground opacity-45"
              >
                <BlockedIcon width={18} height={18} />
                {VERSIONS_COPY.delete}
              </span>
              <p className="px-3.5 pb-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {LAST_VERSION_MESSAGE}
              </p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ActionItem({
  icon,
  onClick,
  danger = false,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-sm transition-colors hover:bg-accent ${
        danger ? "text-primary" : "hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * El pie del Autoguardado de la etiqueta, bajo el campo.
 *
 * Es el de la cabecera en pequeño, y con los mismos tres estados: sin él,
 * renombrar sería el único sitio de la app donde se escribe algo y nada dice
 * si se guardó.
 */
function SaveHint() {
  const { save, saveError } = useVersions();

  if (save === "error") {
    return (
      <span
        role="alert"
        className="flex items-center gap-1.5 text-[10px] tracking-[0.06em] text-primary"
      >
        <AlertIcon width={12} height={12} className="shrink-0" />
        {saveError ?? TREE_COPY.saveFailed}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
      {save === "saving" ? (
        <>
          <span aria-hidden="true" className="size-[6px] rounded-full bg-primary" />
          {TREE_COPY.saving}
        </>
      ) : (
        VERSIONS_COPY.renameHint
      )}
    </span>
  );
}
