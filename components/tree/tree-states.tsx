"use client";

import { useBlocked } from "@/components/connection/connection-provider";
import { PlusIcon } from "@/components/icons/plus-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { ErrorCard } from "@/components/ui/error-card";
import { CANVAS_COPY, CONNECTION_COPY, TREE_COPY } from "@/lib/constants";

/**
 * Los dos estados del árbol que no son «aquí está»: no se pudo, y no hay nada.
 *
 * Están aquí y no dentro de una vista porque los dos dicen algo del ÁRBOL, no
 * de cómo se está mirando: que no hay conexión y que la Versión está vacía se
 * cuenta igual en unas filas que en un lienzo. Dos copias divergirían en el
 * peor sitio posible — el texto que lee alguien cuando algo va mal.
 *
 * La silueta de carga, en cambio, sí es de cada vista: la forma que aparece
 * tiene que ser la forma que se queda, y no es la misma.
 */

export function TreeError() {
  const { error, reload } = useTree();

  return (
    <ErrorCard title={TREE_COPY.errorTitle} body={error ?? TREE_COPY.errorBody}>
      <button
        type="button"
        onClick={() => fire(reload())}
        className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
      >
        {TREE_COPY.retry}
      </button>
    </ErrorCard>
  );
}

export function TreeEmpty({
  readOnlyOnMobile = false,
}: {
  /**
   * Esconde la llamada a crear por debajo de `lg` y explica por qué.
   *
   * Lo pide la Vista Canvas, y no es un detalle: «edición imposible en móvil»
   * es un criterio de aceptación, y una Versión vacía era el único hueco por
   * el que se colaba una escritura — el botón «Primer Nodo» escribe igual que
   * cualquier otro. Se decide por `lg` y no con una consulta de medios en JS
   * porque el resto de la app decide así, y porque un valor que el servidor no
   * puede saber haría parpadear la pantalla al hidratar.
   */
  readOnlyOnMobile?: boolean;
}) {
  const { createRoot } = useTree();
  // Este botón escribe igual que cualquier otro, y era el único de la pantalla
  // vacía: sin apagarlo, sin red se pulsaba y no pasaba absolutamente nada
  // —`run` lanza y `fire` se traga el rechazo—, que es la peor de las
  // respuestas posibles.
  const blocked = useBlocked();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-dashed border-border p-6">
      <span className="font-display text-[15px] text-primary">00</span>
      <p className="text-[15px] font-bold">{TREE_COPY.emptyTitle}</p>
      <p className="max-w-[250px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
        {TREE_COPY.emptyBody}
      </p>

      <button
        type="button"
        onClick={() => fire(createRoot())}
        disabled={blocked}
        title={blocked ? CONNECTION_COPY.blocked : undefined}
        className={`${CTA_PRIMARY_CLASS} px-6 disabled:opacity-35 ${
          readOnlyOnMobile ? "hidden lg:flex" : ""
        }`}
      >
        <PlusIcon />
        {TREE_COPY.firstNode}
      </button>

      {/* Sin esto, en un teléfono el recuadro vacío se quedaría sin salida: la
          Versión no tiene Nodos y aquí no se puede crear ninguno. */}
      {readOnlyOnMobile ? (
        <p className="max-w-[250px] text-center text-xs leading-relaxed text-pretty text-muted-foreground lg:hidden">
          {CANVAS_COPY.emptyOnMobile}
        </p>
      ) : null}
    </div>
  );
}
