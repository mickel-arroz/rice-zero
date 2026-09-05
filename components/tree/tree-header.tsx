"use client";

import Link from "next/link";

import { AnalyzeButton } from "@/components/analysis/analyze-button";
import { AlertIcon } from "@/components/icons/alert-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { useProjects } from "@/components/projects/projects-provider";
import { useTree } from "@/components/tree/tree-provider";
import { ViewSwitch } from "@/components/tree/view-switch";
import { VersionPicker } from "@/components/versions/version-picker";
import { CONNECTION_COPY, ROUTES, TREE_COPY, type TreeView } from "@/lib/constants";

/**
 * La cabecera de la pantalla del árbol: dónde estás, qué Versión, y cómo verla.
 *
 * La comparten las dos vistas y por eso vive aquí. No es solo ahorro de
 * líneas: si cada vista pintara su cabecera, alternar movería el título medio
 * píxel, o una enseñaría el estado del Autoguardado y la otra no, y el
 * selector dejaría de parecer un interruptor para parecer dos pantallas
 * distintas. Compartiéndola, lo único que cambia al pulsar es lo de abajo.
 */
export function TreeHeader({
  projectId,
  view,
  onView,
}: {
  projectId: string;
  view: TreeView;
  onView: (view: TreeView) => void;
}) {
  const { projects, status: projectsStatus } = useProjects();
  const tree = useTree();

  const project = projects.find((candidate) => candidate.id === projectId) ?? null;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={ROUTES.projects}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          {TREE_COPY.back}
        </Link>
        <SaveState />
      </div>

      {/* En escritorio el selector se sube a la fila del título en vez de
          ocupar una propia: son unos 50 px de alto que se lleva el árbol, que
          es lo que se ha venido a mirar. En móvil no cabe al lado de un título
          largo, así que sigue encima — de ahí el `order`, que deja el mismo
          orden de lectura de siempre sin pintar el selector dos veces. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        {/* El interruptor y la puerta del Panel de IA comparten fila: la puerta
            NO es una tercera vista —el panel se abre ENCIMA del árbol, no en su
            lugar— pero es la otra cosa que se hace desde aquí, y en móvil la
            fila del interruptor es la única que tiene sitio a la derecha. */}
        {/* En móvil se reparten la fila —interruptor a la izquierda, puerta a la
            derecha—; en escritorio van juntos al lado del título, que es donde
            los pone el boceto. `justify-end` y no `between` porque ahí la fila
            ya no es suya: la comparten con el `h1`. */}
        <div className="order-first flex items-center justify-between gap-3 lg:order-none lg:justify-end">
          <ViewSwitch view={view} onChange={onView} />
          <AnalyzeButton />
        </div>

        {project ? (
          <h1 className="text-[29px] leading-none tracking-[0.02em] text-balance lg:order-first lg:min-w-0 lg:text-5xl">
            {project.title}
          </h1>
        ) : (
          // Mientras la lista de Proyectos viaja no se inventa un título: se
          // deja su hueco, del alto que va a ocupar.
          <span
            className="w-52 rounded-lg bg-accent lg:order-first"
            style={{ height: 29 }}
            aria-hidden={projectsStatus === "loading"}
          />
        )}
      </div>

      {/* La pastilla que solo DECÍA la Versión pasa a ser el control que la
          cambia (#14). La cuenta de Nodos se queda fuera del botón: es del
          árbol que estás mirando, no del selector, y meterla dentro haría que
          la pastilla cambiara de ancho cada vez que se crea un Nodo. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <VersionPicker projectId={projectId} />
        <span className="text-xs text-muted-foreground">
          {TREE_COPY.nodeCount(tree.nodes.length)}
        </span>
      </div>
    </header>
  );
}

/**
 * El pie del Autoguardado: lo único que le dice al usuario que no hay botón.
 *
 * Cuatro estados y no dos: «guardado» tranquiliza, «guardando» explica el
 * parpadeo, el fallo tiene que decir QUÉ pasó —un icono rojo sin frase deja a
 * la persona sin saber si perdió lo que acaba de escribir— y «pendiente» es lo
 * que hace que sin red este pie siga sin mentir: hay algo escrito, no está
 * guardado, y saldrá solo. Ver `SaveState` en `tree-provider.tsx`.
 */
function SaveState() {
  const { save, saveError } = useTree();

  if (save === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-primary uppercase">
        {/* El punto HUECO, contra el lleno de «Guardando…»: nada está saliendo
            hacia ningún sitio, hay algo esperando a que se pueda. */}
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full border border-primary"
        />
        {CONNECTION_COPY.savePending}
      </span>
    );
  }

  if (save === "error") {
    return (
      <span
        role="alert"
        className="flex items-center gap-1.5 text-right text-[10px] tracking-[0.06em] text-primary"
      >
        <AlertIcon width={14} height={14} className="shrink-0" />
        {saveError ?? TREE_COPY.saveFailed}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase text-muted-foreground">
      {save === "saving" ? (
        <>
          <span aria-hidden="true" className="size-[7px] rounded-full bg-primary" />
          {TREE_COPY.saving}
        </>
      ) : (
        <>
          <CheckIcon width={14} height={14} />
          {TREE_COPY.saved}
        </>
      )}
    </span>
  );
}
