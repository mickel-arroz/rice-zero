"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { AnalysesIcon } from "@/components/icons/analyses-icon";
import { ANALYSIS_COPY, ROUTES } from "@/lib/constants";

/**
 * La puerta del Análisis, en la cabecera del árbol.
 *
 * Es el enlace que LLEVA a su pantalla —un enlace y no un botón desde #52: va a
 * otra ruta, así que se puede abrir en otra pestaña y copiar— y a la vez el
 * único indicador de la IA mientras se está en el árbol. Que es casi siempre:
 * el caso entero de «editar mientras genera» es estar aquí y no allí. Sin
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
  const { door } = useAnalysis();
  // De la URL y no de una prop: esto vive dentro de la cabecera del árbol, que
  // ya recibe el Proyecto, pero la Versión no llega hasta aquí — y hacerla
  // bajar tres componentes para construir un enlace es más frágil que leerla
  // de donde ya está escrita.
  const params = useParams<{ projectId: string; versionId: string }>();

  return (
    <Link
      href={ROUTES.analysis(params.projectId, params.versionId)}
      aria-label={ANALYSIS_COPY.openPanel}
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
    </Link>
  );
}
