/**
 * Tiempo relativo, en español y corto.
 *
 * A mano y no con `Intl.RelativeTimeFormat` por dos razones. La primera es que
 * el formateador elige la unidad después de que alguien le diga cuál —hay que
 * calcular «cuántas horas» igual—, así que solo ahorraría la tabla de sufijos.
 * La segunda es que su forma corta depende de los datos de locale del entorno,
 * y una tarjeta que dice «hace 2 h» en un navegador y «hace 2 horas» en otro no
 * es la misma tarjeta.
 *
 * Módulo puro y sin dependencias, igual que `lib/path.ts`: lo consumen
 * componentes de cliente, y se prueba sin montar ninguno.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** El mes «de calendario» no existe aquí: a esta escala nadie cuenta días. */
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Los escalones, del más fino al más grueso. En una tabla y no en una escalera
 * de `if` para que se lean de una vez y para que añadir uno sea una línea.
 */
const STEPS: { limit: number; unit: number; suffix: string }[] = [
  { limit: HOUR, unit: MINUTE, suffix: "min" },
  { limit: DAY, unit: HOUR, suffix: "h" },
  { limit: WEEK, unit: DAY, suffix: "d" },
  { limit: MONTH, unit: WEEK, suffix: "sem" },
  { limit: YEAR, unit: MONTH, suffix: "mes" },
];

/**
 * «hace 2 h», «hace 3 d», «hace un momento».
 *
 * @param date el instante que se describe.
 * @param now contra qué se compara. Es un parámetro y no `Date.now()` por
 *   dentro para que la función sea pura: así el test fija el reloj en vez de
 *   perseguirlo, y quien pinta una lista entera usa el MISMO ahora para todas
 *   las tarjetas — con el reloj por dentro, dos filas de la misma lista podrían
 *   caer a lados distintos de un escalón.
 *
 * Una fecha en el futuro se trata como «ahora mismo»: pasa cuando el reloj del
 * navegador va por detrás del motor, y «dentro de 3 s» en una lista de
 * Proyectos solo parece un error.
 */
export function relativeTime(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "hace un momento";

  for (const { limit, unit, suffix } of STEPS) {
    if (elapsed < limit) {
      const amount = Math.floor(elapsed / unit);
      // «mes» es el único que cambia de forma en plural; los demás son
      // abreviaturas y no llevan marca.
      const label = suffix === "mes" && amount > 1 ? "meses" : suffix;
      return `hace ${amount} ${label}`;
    }
  }

  const years = Math.floor(elapsed / YEAR);
  return `hace ${years} ${years === 1 ? "año" : "años"}`;
}

/**
 * Los meses, abreviados y en minúscula. A mano por lo mismo que los sufijos de
 * arriba: `toLocaleDateString` depende de los datos de locale del entorno, y
 * una fila del Historial que dice «2 sept.» en un navegador y «2 sep» en otro
 * no es la misma fila.
 */
const MONTHS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function clock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Cuántos días de calendario —no de 24 h— separan a dos fechas. */
function calendarDaysApart(date: Date, now: Date): number {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(now) - day(date)) / DAY);
}

/**
 * «hoy 14:32», «ayer 19:05», «2 sep · 11:48», «11 dic 2025 · 09:20».
 *
 * Aparte de `relativeTime` y no una variante suya porque contestan a preguntas
 * distintas. «Hace 2 h» sirve para ordenar de un vistazo una lista de Proyectos
 * que se tocan a diario; el Historial de Análisis necesita lo contrario —QUÉ
 * MOMENTO fue— porque es donde se comparan dos Análisis entre sí y donde se
 * cruza una fila con el nombre del `.md` que se descargó de ella, que lleva el
 * mismo sello. «Hace 5 d» no se cruza con nada.
 *
 * Se cuenta por días de CALENDARIO y no por horas transcurridas, y ahí está la
 * única sutileza: a las 00:30, lo de las 23:50 de anoche pasó hace cuarenta
 * minutos y aun así fue ayer. Contar 24 h lo llamaría «hoy», que es la única
 * respuesta que no vale.
 *
 * @param now contra qué se compara, por lo mismo que en `relativeTime`: la
 *   función se queda pura y una lista entera se pinta con el MISMO ahora.
 */
export function dateTimeLabel(date: Date, now: Date): string {
  const days = calendarDaysApart(date, now);
  if (days <= 0) return `hoy ${clock(date)}`;
  // «Ayer» manda sobre el año: un 1 de enero, lo del 31 de diciembre es de
  // ayer y de otro año a la vez, y «ayer» es lo útil. El año ya se dirá
  // pasado mañana, cuando «ayer» deje de valer.
  if (days === 1) return `ayer ${clock(date)}`;

  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  const year = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${day}${year} · ${clock(date)}`;
}
