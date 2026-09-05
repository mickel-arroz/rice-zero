"use client";

/**
 * El único sitio de la app que habla con el portapapeles y con las descargas
 * del navegador.
 *
 * Está APARTE de `components/analysis/export.ts` a propósito: allí se decide
 * qué texto sale y cómo se llama el archivo —puro, y probado—, y aquí se
 * empuja al sistema operativo, que es lo que no se puede probar sin un
 * navegador. Juntos, el módulo entero dejaría de tener pruebas por culpa de
 * dos líneas.
 *
 * ── Esto NO se bloquea sin conexión ───────────────────────────────────────
 *
 * Y es deliberado, al revés que todo lo demás que se pulsa en el panel. El
 * criterio de #19 es que la EDICIÓN se bloquea y la CONSULTA no; copiar y
 * descargar no escriben en ningún sitio —el Análisis ya está en la pantalla,
 * el renderer es local y el archivo se arma en memoria—, así que apagarlas sin
 * red sería quitar justo lo que sí se puede hacer en un tren.
 */

import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * Deja el texto en el portapapeles.
 *
 * @throws si el navegador lo niega. Pasa de verdad y por dos motivos
 *   distintos: fuera de un contexto seguro `navigator.clipboard` ni existe, y
 *   con permiso denegado la promesa se rompe. Quien llama lo convierte en un
 *   estado de la pastilla —no se copió— en vez de dejar creer que sí.
 */
export async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error(ANALYSIS_COPY.copyUnsupported);
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Baja el texto como archivo.
 *
 * Un `Blob` y un enlace de usar y tirar, que es la única forma que hay de
 * ofrecer un archivo generado en el cliente. El `type` es `text/markdown` para
 * que el sistema le ponga el icono correcto; lo que decide la extensión es el
 * `download`, y el nombre lo escribe `export.ts`.
 *
 * El `Blob` se construye con `endings` por defecto —`"transparent"`—, que es lo
 * que sostiene el «byte a byte» del ticket: no toca los saltos de línea ni
 * antepone BOM. Poner `"native"` los convertiría a los del sistema, y el
 * archivo dejaría de ser lo que devolvió el renderer.
 *
 * Los dos detalles feos de abajo son los que hacen que esto funcione fuera de
 * Chrome, y ninguno se puede quitar «porque parece que sobra»:
 *
 *   · El enlace se INSERTA en el documento antes de pulsarlo. Firefox ignora
 *     el `click()` de un `<a>` que no está en el DOM, y no avisa: la descarga
 *     simplemente no ocurre.
 *   · La URL se revoca en el TURNO SIGUIENTE. Revocarla justo después de
 *     `click()` llega antes de que el navegador haya empezado a leer el
 *     `Blob`, y Safari cancela la descarga a medias. Revocarla hace falta de
 *     todas formas: sin eso, quien exporta ocho Tickets seguidos deja ocho
 *     copias del texto retenidas hasta cerrar la pestaña.
 */
export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;

  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
