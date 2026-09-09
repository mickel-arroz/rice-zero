"use client";

import { useEffect } from "react";

import { AnalysisPanelBody } from "@/components/analysis/analysis-layer";
import { useAnalysis } from "@/components/analysis/analysis-provider";
import { ANALYSIS_COPY, ROUTES } from "@/lib/constants";

/**
 * El Análisis, en su propia pantalla.
 *
 * Era una capa —acoplada a la derecha en escritorio, una hoja por abajo en el
 * teléfono— y desde #52 es una ruta anidada bajo la Versión, con el Historial
 * dentro. El motivo es que se lee entero: en 440 px compitiendo con el árbol,
 * un Análisis con nueve Tickets se recorría por una rendija.
 *
 * Lo que NO se pierde al mudarse:
 *
 *   · **Editar mientras genera.** Los providers viven en `layout.tsx`, un
 *     escalón por encima de esta página y de la del árbol, así que venir aquí
 *     no desmonta el árbol ni cancela una generación en vuelo. Volver tampoco.
 *   · **Enterarse de lo que pasa mientras no se mira.** La puerta de la
 *     cabecera del árbol sigue diciendo si genera o si ya está, y el aviso de
 *     fallo sigue montado allí (`AnalysisLayer`). Los dos son de la pantalla
 *     del árbol a propósito: hacen falta justo cuando el Análisis no se ve.
 *
 * Lo de dentro es exactamente el cuerpo del panel de antes, sin duplicar: la
 * cabecera con su puerta al Historial, el Análisis, y el pie con las
 * Directrices. Lo único que cambia es el botón de la esquina — donde había una
 * equis que cerraba una capa, hay una vuelta al Proyecto.
 */
export function AnalysisScreen({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  const { openPanel, closePanel } = useAnalysis();

  /**
   * Estar en esta ruta ES tener el panel abierto.
   *
   * El provider guarda esa bandera desde antes de que hubiera ruta, y de ella
   * cuelgan dos cosas que siguen valiendo: que un Análisis recién llegado deje
   * de contar como no leído, y qué dice la puerta de la cabecera del árbol.
   * En vez de reescribir esa lógica contra el router, la ruta le cuenta al
   * provider lo mismo que antes le contaba el botón.
   */
  useEffect(() => {
    openPanel();
    return closePanel;
  }, [openPanel, closePanel]);

  return (
    // Ni relleno ni ancho propios: los pone el Contenedor. El cuerpo del panel
    // sí trae los suyos —nació dentro de una capa que no tenía ninguno— y por
    // eso se le cancelan con el margen negativo: dos rellenos sumados dejarían
    // el Análisis en una columna más estrecha que el resto de la app.
    <main
      aria-label={ANALYSIS_COPY.label}
      className="-mx-2 flex flex-1 flex-col"
    >
      <AnalysisPanelBody backHref={ROUTES.version(projectId, versionId)} />
    </main>
  );
}
