/**
 * Sacar un Análisis del panel: qué texto se lleva y cómo se llama el archivo.
 *
 * Módulo puro. No toca el portapapeles ni crea descargas —eso es
 * `components/analysis/transfer.ts`, que sí habla con el navegador— y no
 * importa React.
 *
 * ── Por qué esto es tan poco código ───────────────────────────────────────
 *
 * Porque el ADR 0003 ya pagó la factura. `ai_analyses` guarda el OBJETO, no el
 * texto, así que exportar no lee un campo guardado ni transforma nada: llama al
 * renderer de hoy sobre el Análisis de aquel día. Eso es lo que hace que un
 * Análisis de la semana pasada se descargue con el formato de hoy sin migrar
 * una fila, y lo que deja este archivo reducido a una decisión de verdad —el
 * NOMBRE del archivo— más el envoltorio que la une con el texto.
 *
 * ── La promesa que sostiene ───────────────────────────────────────────────
 *
 * «El `.md` descargado es byte a byte la salida del renderer, sin adorno
 * añadido por la UI» es un criterio de aceptación del ticket, y se cumple aquí
 * por AUSENCIA: no hay ninguna línea que concatene una cabecera, una fecha, una
 * firma ni un salto de más. La prueba lo afirma comparando con la llamada al
 * renderer, no con un texto a mano, para que siga valiendo cuando el formato
 * cambie: lo que se prueba es que esta capa es transparente.
 */

import { renderMasterPrompt, renderTicketPrompt } from "@/lib/ai";
import type { Analysis } from "@/lib/backend/ports";

/** Un archivo listo para el portapapeles o para el disco. */
export type PromptExport = {
  filename: string;
  /** Exactamente lo que devolvió el renderer. Ver la cabecera del módulo. */
  text: string;
};

/** El prefijo de todo lo que sale de aquí, para reconocerlo en Descargas. */
const PREFIX = "rice0";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * El sello de un Análisis para su nombre de archivo: `2026-09-05-1432`.
 *
 * En hora LOCAL y no en UTC, y no es indiferente: quien acaba de descargar dos
 * Análisis los distingue por su propio reloj, y un sello en UTC pondría «las
 * 03:20» a lo que para él fue anoche. Es la misma hora que el panel enseña al
 * lado del modelo, así que el archivo y la fila del Historial se cruzan de un
 * vistazo.
 *
 * Se sella con la fecha del ANÁLISIS y no con la de la descarga: descargar dos
 * veces el mismo Análisis tiene que dar el mismo archivo, y descargar dos
 * Análisis distintos el mismo minuto tiene que dar dos.
 */
export function fileStamp(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/** El Análisis entero, para pegar en un agente de código. */
export function masterExport(analysis: Analysis): PromptExport {
  return {
    filename: `${PREFIX}-master-${fileStamp(analysis.createdAt)}.md`,
    text: renderMasterPrompt(analysis.content),
  };
}

/**
 * Un solo Ticket, con el mínimo de Spec que lo hace entendible suelto.
 *
 * El id va CRUDO en el nombre y no se sanea. Se puede afirmar y no es un
 * descuido: el schema obliga a que un id de Ticket sea `t` y un número
 * (`/^t\d+$/`), así que no existe ningún id legal que necesite escaparse para
 * un sistema de archivos. El día que el schema abra la mano, la prueba de este
 * archivo es la que hay que venir a mirar.
 *
 * @throws si el Ticket no existe. Lo lanza el renderer, y es lo correcto: un
 *   `.md` en blanco en la carpeta de Descargas no delata el bug de quien llamó.
 */
export function ticketExport(analysis: Analysis, ticketId: string): PromptExport {
  return {
    filename: `${PREFIX}-${ticketId}-${fileStamp(analysis.createdAt)}.md`,
    text: renderTicketPrompt(analysis.content, ticketId),
  };
}
