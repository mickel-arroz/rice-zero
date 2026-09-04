"use client";

import { useCallback, useEffect, useState } from "react";

import { AnalysisLayer } from "@/components/analysis/analysis-layer";
import { useAnalysisOpen } from "@/components/analysis/analysis-provider";
import { CanvasView } from "@/components/canvas/canvas-view";
import { RegistroView } from "@/components/registro/registro-view";
import { NodeToolbar } from "@/components/tree/node-toolbar";
import { TreeHeader } from "@/components/tree/tree-header";
import { TREE_VIEWS, type TreeView } from "@/lib/constants";
import {
  TREE_VIEW_COOKIE,
  cookieValue,
  treeViewCookieAssignment,
} from "@/lib/shell/tree-view";

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
  const canvas = view === TREE_VIEWS.canvas;
  // Solo para hacerle sitio al panel acoplado. El panel se pinta ÉL solo, en
  // una capa fija; esta pantalla no lo posiciona, únicamente se aparta.
  //
  // Por el contexto PEQUEÑO, y esa es la diferencia entre cumplir el criterio
  // de «cero bloqueos» y fingirlo: con el grande, cada tecla escrita en las
  // Directrices repintaba esta pantalla y con ella el Registro y el Canvas.
  const analysisOpen = useAnalysisOpen();

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
    // El `max-w` NO va en el `main`: la barra de acciones es hija suya y en
    // escritorio es una pastilla ancha que se centra en toda la columna. Con el
    // límite aquí, la pastilla lo desbordaba y metía scroll horizontal en la
    // página entera.
    //
    // A pantalla completa el `main` sale del flujo y tapa la app: es lo que
    // hace que el lienzo ocupe TODO, cabecera de la app incluida. Se hace aquí
    // y no dentro del lienzo porque «toda la pantalla» incluye lo que hay
    // ALREDEDOR del lienzo — la sidebar y la cabecera de la app viven fuera de
    // este componente y solo un `fixed` a nivel de `main` las tapa.
    <main
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background p-3"
          : `flex flex-1 flex-col px-6 py-6 lg:py-10 ${
              // Acoplado, el panel es una columna fija pegada al borde derecho
              // de la ventana; esto es lo que le HACE SITIO. Sin este relleno el
              // panel taparía el árbol en vez de ponerse a su lado, y en
              // escritorio eso rompería lo único que hace falta ahí: leer el
              // Análisis con el árbol delante para poder editarlo.
              analysisOpen ? "lg:pr-[calc(440px+2rem)] lg:pl-8" : "lg:px-16"
            }`
      }
    >
      {/* El Canvas se queda con TODO el ancho en escritorio: el ancho de
          lectura de una columna de texto es lo que necesita una lista, y lo
          que le sobra a un diagrama que ya se puede desplazar. */}
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          canvas || fullscreen ? "" : "lg:mx-auto lg:w-full lg:max-w-3xl"
        }`}
      >
        {/* A pantalla completa no hay cabecera: es lo que se pide al pedirla. */}
        {fullscreen ? null : (
          <TreeHeader projectId={projectId} view={view} onView={changeView} />
        )}

        <div className={`flex min-h-0 flex-1 flex-col ${fullscreen ? "" : "mt-5"}`}>
          {canvas ? (
            <CanvasView fullscreen={fullscreen} onFullscreen={toggleFullscreen} />
          ) : (
            <RegistroView />
          )}
        </div>
      </div>

      {/* La MISMA barra en las dos vistas, y en el Canvas la monta el propio
          lienzo para que flote encima en vez de encogerlo. Aquí queda la del
          Registro, que sí va en flujo: la lista se desplaza y su última fila
          tiene que poder subir por encima de la barra. */}
      {canvas ? null : <NodeToolbar />}

      {/* Va al final y fuera de la columna: es una capa, no contenido. Lleva
          dentro la hoja Y el aviso, porque en móvil se apilan por el mismo
          borde y el aviso tiene que salir aunque la hoja esté cerrada. */}
      <AnalysisLayer />
    </main>
  );
}
