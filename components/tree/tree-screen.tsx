"use client";

import { useCallback, useEffect, useState } from "react";

import { AnalysisLayer } from "@/components/analysis/analysis-layer";
import { CanvasView } from "@/components/canvas/canvas-view";
import { RegistroView } from "@/components/registro/registro-view";
import { NodeDialogs } from "@/components/tree/node-dialogs";
import { TreeSearch, TreeSearchResults } from "@/components/tree/tree-search";
import { NodeToolbar } from "@/components/tree/node-toolbar";
import { TreeHeader } from "@/components/tree/tree-header";
import { TREE_VIEWS, type TreeView } from "@/lib/constants";
import {
  TREE_VIEW_COOKIE,
  cookieValue,
  treeViewCookieAssignment,
} from "@/lib/shell/tree-view";
import { isSearching } from "@/lib/tree/search";

/**
 * La pantalla de un Proyecto: su árbol, visto de una de las dos maneras.
 *
 * Lo único que hace es decidir qué se pinta debajo de la cabecera. Todo lo
 * demás —los datos, la selección, lo tecleado sin guardar— vive en
 * `TreeProvider`, que monta la PÁGINA por encima de esto: por eso alternar de
 * vista no recarga nada ni pierde nada, que es un criterio del ticket.
 *
 * La vista elegida se recuerda POR PROYECTO en una cookie, y el servidor ya la
 * lee para pintar la correcta en el primer HTML: ver `lib/shell/tree-view.ts`.
 * No va en la URL porque un `?vista=` obligaría a un viaje al servidor por
 * cada pulsación del interruptor para no ganar nada que se haya pedido.
 */
export function TreeScreen({
  projectId,
  initialView,
}: {
  projectId: string;
  /** Lo que dijo la cookie. Lo resuelve el servidor para que no haya salto. */
  initialView: TreeView;
}) {
  const [view, setView] = useState<TreeView>(initialView);
  const [fullscreen, setFullscreen] = useState(false);
  /**
   * Lo que hay escrito en la Búsqueda.
   *
   * Estado de la PANTALLA y no del provider: filtrar no cambia el árbol, solo
   * qué parte de él se está mirando, y guardarlo con los datos habría hecho que
   * el Canvas heredara un filtro que no pinta.
   *
   * No va en la URL. La Búsqueda dentro de la Versión es un gesto de un
   * momento —se escribe, se pulsa el resultado y se limpia sola—, y ponerla en
   * la dirección llenaría el historial del navegador de una entrada por letra.
   */
  const [query, setQuery] = useState("");
  const canvas = view === TREE_VIEWS.canvas;
  const searching = isSearching(query);

  const changeView = useCallback(
    (next: TreeView) => {
      setView(next);
      // A pantalla completa se entra desde el lienzo, así que salir de él
      // tiene que devolver la pantalla: si no, la Vista Registro se quedaría
      // tapando la app entera sin cabecera y sin forma obvia de volver.
      setFullscreen(false);
      document.cookie = treeViewCookieAssignment(
        cookieValue(document.cookie, TREE_VIEW_COOKIE),
        projectId,
        next,
      );
    },
    [projectId],
  );

  /**
   * Pide —o suelta— la pantalla completa de verdad, la del navegador.
   *
   * Se llama DENTRO del clic y no desde un efecto porque el navegador solo la
   * concede mientras dura el gesto que la pidió. Y si la niega —Safari en
   * iPhone no la da a un elemento cualquiera— no pasa nada: el estado sigue
   * puesto y la pantalla se agranda igual con CSS, que es el 90 % del efecto.
   */
  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen;
    setFullscreen(next);

    const root = document.documentElement;
    if (next) {
      if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;

    // Escape sale, tanto de la pantalla completa del navegador como de la
    // nuestra. El navegador ya lo hace por su cuenta, pero cuando no la
    // concedió no hay nadie más escuchando.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreen(false);
    }
    // Y al revés: si se sale por el gesto del sistema, esto se entera.
    function onFullscreenChange() {
      if (!document.fullscreenElement) setFullscreen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [fullscreen]);

  return (
    // Ni relleno ni ancho propios: los pone el Contenedor, una vez para todas
    // las pantallas. Ver `components/layout/app-frame.tsx`.
    //
    // A pantalla completa el `main` sale del flujo y tapa la app: es lo que
    // hace que el lienzo ocupe TODO, cabecera de la app incluida. Se hace aquí
    // y no dentro del lienzo porque «toda la pantalla» incluye lo que hay
    // ALREDEDOR del lienzo — la sidebar, la cabecera de la app y el propio
    // contenedor viven fuera de este componente y solo un `fixed` a nivel de
    // `main` los tapa.
    <main
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-3"
          : "flex flex-1 flex-col"
      }
    >
      {/* Envuelve a las DOS vistas y a la barra: los diálogos de un Nodo los
          abren tres sitios —los botones de la barra, dos atajos de teclado
          desde la fila, y el propio lienzo— y los tres tienen que abrir el
          mismo. Ver `node-dialogs.tsx`. */}
      <NodeDialogs>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* A pantalla completa no hay cabecera: es lo que se pide al pedirla.
              Y con ella se va la Búsqueda, que ahora vive dentro — ahí el
              lienzo ES la pantalla y el campo tendría que flotar sobre él. */}
          {fullscreen ? null : (
            <TreeHeader
              projectId={projectId}
              view={view}
              onView={changeView}
              // El campo lo monta la pantalla y lo COLOCA la cabecera: lo que
              // se ha escrito decide si se ven los resultados o el árbol, y esa
              // decisión es de aquí. Ver el `search` de `TreeHeader`.
              search={<TreeSearch query={query} onQuery={setQuery} />}
            />
          )}

          <div
            className={`flex min-h-0 flex-1 flex-col gap-3.5 ${fullscreen ? "" : "mt-5"}`}
          >
            {searching ? (
              // Los resultados REEMPLAZAN a la vista, no se ponen al lado: en
              // el teléfono no hay ancho para dos columnas, y en escritorio un
              // panel obligaría a decidir cuál de los dos manda cuando se pulsa
              // un resultado. Se pulsa, se limpia y se vuelve al árbol con el
              // Nodo ya señalado.
              <TreeSearchResults query={query} onQuery={setQuery} />
            ) : canvas ? (
              <CanvasView
                fullscreen={fullscreen}
                onFullscreen={toggleFullscreen}
              />
            ) : (
              <RegistroView />
            )}
          </div>
        </div>

        {/* La MISMA barra en las dos vistas, y en el Canvas la monta el propio
            lienzo para que flote encima en vez de encogerlo. Aquí queda la del
            Registro, que sí va en flujo: la lista se desplaza y su última fila
            tiene que poder subir por encima de la barra. */}
        {canvas || searching ? null : <NodeToolbar />}
      </NodeDialogs>

      {/* El aviso de que una generación falló, en su capa. Ya no lleva panel
          dentro: desde #52 el Análisis tiene pantalla propia, y esto se quedó
          porque hace falta justo cuando el Análisis no se está mirando. */}
      <AnalysisLayer />
    </main>
  );
}
