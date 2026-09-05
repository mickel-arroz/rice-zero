/**
 * Las decisiones del Historial que no son cableado de React: cuál Análisis
 * manda y cuál se está enseñando.
 *
 * Mismo criterio que `components/analysis/panel.ts`: lo que tiene una DECISIÓN
 * dentro sale a funciones puras para poder comprobarlo sin montar un
 * componente. Módulo puro: no importa React ni toca red.
 *
 * ── De dónde sale «el vigente» ────────────────────────────────────────────
 *
 * De una promesa del puerto: `AnalysisRepository.listByVersion` devuelve «los
 * Análisis de una Versión, del más nuevo al más viejo». El vigente es, por
 * tanto, el primero — y no hay ninguna columna que lo diga ni ninguna falta.
 * Este archivo existe para que esa deducción esté escrita UNA vez: repartida
 * por el panel, la lista y la fila, el día que el orden del puerto cambie
 * habría tres sitios donde enterarse y ninguno fallaría en voz alta.
 */

import type { Analysis } from "@/lib/backend/ports";
import { dateTimeLabel } from "@/lib/time";

/** El Análisis que manda en una Versión, o ninguno si no se ha analizado. */
export function currentAnalysis(analyses: readonly Analysis[]): Analysis | null {
  return analyses[0] ?? null;
}

/** ¿Es éste el vigente? Lo pregunta la fila del Historial para marcarse. */
export function isCurrent(analyses: readonly Analysis[], id: string): boolean {
  return currentAnalysis(analyses)?.id === id;
}

/**
 * Cuál se pinta: el elegido en el Historial, o el vigente si no hay ninguno.
 *
 * La caída al vigente cuando lo elegido NO ESTÁ es la razón de que esto sea una
 * función y no un `find()` suelto en el render. Borrar el Análisis que estás
 * leyendo deja la elección apuntando a algo que ya no existe, y sin la caída el
 * panel se quedaría en blanco justo después de una acción que sí funcionó, sin
 * más salida que cerrar la hoja.
 *
 * @param selectedId `null` es «no he elegido nada», que es el estado normal:
 *   el panel enseña el vigente hasta que alguien entra al Historial.
 */
export function shownAnalysis(
  analyses: readonly Analysis[],
  selectedId: string | null,
): Analysis | null {
  if (selectedId === null) return currentAnalysis(analyses);
  return analyses.find((analysis) => analysis.id === selectedId) ?? currentAnalysis(analyses);
}

/**
 * Cuándo se escribió un Análisis, o nada si todavía no hay reloj.
 *
 * Está aquí y no repetido en los cuatro sitios que lo pintan —la cabecera, la
 * fila del Historial, el aviso de «esto es antiguo» y el diálogo de borrar—
 * porque los cuatro tienen que decir la MISMA fecha con el MISMO formato: es lo
 * que permite cruzar una fila con el `.md` que se descargó de ella, que lleva
 * el mismo sello.
 *
 * Devuelve `null` en vez de un texto de relleno cuando `now` aún no está fijado
 * (ver el provider: se fija al ABRIR la hoja). Callar es la única opción que no
 * miente — la primera versión rellenaba el hueco con el modelo, y el diálogo de
 * borrar llegaba a decir «¿Borrar el Análisis de gemini-2.5-flash?».
 */
export function analysisWhen(analysis: Analysis, now: Date | null): string | null {
  return now ? dateTimeLabel(analysis.createdAt, now) : null;
}
