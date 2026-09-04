"use client";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { AnalysesIcon } from "@/components/icons/analyses-icon";
import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * La puerta del Panel de IA, en la cabecera del árbol.
 *
 * Es el botón que abre la hoja Y el único indicador de la IA cuando la hoja no
 * está delante — que es lo que pasa siempre que alguien cierra el panel para
 * seguir escribiendo, o sea, el caso que este ticket existe para permitir. Sin
 * esto, una generación de cuarenta segundos sería invisible y su resultado
 * llegaría sin que nadie se entere.
 *
 * Qué dice lo decide `doorState`, que es una función pura y probada; aquí solo
 * se pinta. Y se pinta encendido en vez de subir un cartel a propósito: un
 * toast de éxito interrumpiría justo la edición que la generación no
 * bloqueante promete no interrumpir. Es el mismo criterio con el que la
 * cabecera ya cuenta el Autoguardado — un estado en su sitio, nunca encima.
 */
export function AnalyzeButton() {
  const { door, open, openPanel, closePanel } = useAnalysis();

  return (
    <button
      type="button"
      onClick={open ? closePanel : openPanel}
      aria-expanded={open}
      aria-label={open ? ANALYSIS_COPY.closePanel : ANALYSIS_COPY.openPanel}
      // Relleno siempre, en los tres estados. Es la acción principal de la
      // cabecera —lo que se ha venido a hacer después de escribir el árbol— y
      // de contorno competía en peso con el interruptor de vista, que solo
      // cambia cómo se mira lo que ya hay.
      className="flex h-[34px] shrink-0 items-center gap-[7px] rounded-full border border-primary bg-primary pr-3.5 pl-3 text-xs tracking-[0.06em] text-primary-foreground uppercase transition-opacity hover:opacity-90"
    >
      {door === "generando" ? (
        // El punto y no el icono: es el mismo lenguaje con el que el pie del
        // Autoguardado dice «algo está pasando ahora mismo».
        <span
          aria-hidden="true"
          className="size-[7px] rounded-full bg-primary-foreground"
        />
      ) : (
        <AnalysesIcon width={16} height={16} />
      )}
      {ANALYSIS_COPY.door[door]}
    </button>
  );
}
