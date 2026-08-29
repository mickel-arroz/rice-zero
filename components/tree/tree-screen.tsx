"use client";

import { useState } from "react";

import { CanvasView } from "@/components/canvas/canvas-view";
import { RegistroView } from "@/components/registro/registro-view";
import { NodeToolbar } from "@/components/tree/node-toolbar";
import { TreeHeader } from "@/components/tree/tree-header";
import { TREE_VIEWS, type TreeView } from "@/lib/constants";

/**
 * La pantalla de un Proyecto: su árbol, visto de una de las dos maneras.
 *
 * Lo único que hace es decidir qué se pinta debajo de la cabecera. Todo lo
 * demás —los datos, la selección, lo tecleado sin guardar— vive en
 * `TreeProvider`, que monta la PÁGINA por encima de esto: por eso alternar de
 * vista no recarga nada ni pierde nada, que es un criterio del ticket.
 *
 * La vista elegida es estado local y no un parámetro de la URL, a propósito.
 * Un `?vista=` obligaría a un viaje al servidor por cada pulsación del
 * interruptor para no ganar nada que se haya pedido: la URL de un Proyecto
 * lleva a su árbol, y cómo se mira es una preferencia del momento. El día que
 * haga falta compartir un enlace a la vista, se sube aquí y se sabrá por qué.
 */
export function TreeScreen({ projectId }: { projectId: string }) {
  const [view, setView] = useState<TreeView>(TREE_VIEWS.registro);
  const canvas = view === TREE_VIEWS.canvas;

  return (
    // El `max-w` NO va en el `main`: la barra de acciones es hija suya y en
    // escritorio es una pastilla ancha que se centra en toda la columna. Con el
    // límite aquí, la pastilla lo desbordaba y metía scroll horizontal en la
    // página entera.
    <main className="flex flex-1 flex-col px-6 py-6 lg:px-16 lg:py-10">
      {/* El Canvas se queda con TODO el ancho en escritorio: el ancho de
          lectura de una columna de texto es lo que necesita una lista, y lo
          que le sobra a un diagrama que ya se puede desplazar. */}
      <div
        className={`flex flex-1 flex-col ${
          canvas ? "" : "lg:mx-auto lg:w-full lg:max-w-3xl"
        }`}
      >
        <TreeHeader projectId={projectId} view={view} onView={setView} />

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          {canvas ? <CanvasView /> : <RegistroView />}
        </div>
      </div>

      {/* La MISMA barra en las dos vistas, escondida en el Canvas por debajo de
          `lg`: ahí el lienzo es solo consulta.

          Escondida con CSS y no desmontada con una consulta de medios en JS,
          por lo mismo que el resto de la app decide por `lg`: el servidor no
          sabe el ancho de la ventana, así que decidirlo en el cliente haría
          aparecer la barra un fotograma después de hidratar. `display: none`
          no se pulsa ni se enfoca, así que «edición imposible en móvil» se
          cumple igual. */}
      <NodeToolbar className={canvas ? "hidden lg:block" : ""} />
    </main>
  );
}
