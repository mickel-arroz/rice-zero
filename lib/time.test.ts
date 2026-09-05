import { describe, expect, it } from "vitest";

import { dateTimeLabel, relativeTime } from "@/lib/time";

/** El reloj es fijo: la función es pura, así que el test no persigue nada. */
const NOW = new Date("2026-08-28T12:00:00.000Z");

function hace(ms: number): string {
  return relativeTime(new Date(NOW.getTime() - ms), NOW);
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

describe("relativeTime", () => {
  it("por debajo del minuto no cuenta", () => {
    expect(hace(0)).toBe("hace un momento");
    expect(hace(59 * SECOND)).toBe("hace un momento");
  });

  it("cuenta minutos, horas y días", () => {
    expect(hace(MINUTE)).toBe("hace 1 min");
    expect(hace(45 * MINUTE)).toBe("hace 45 min");
    expect(hace(2 * HOUR)).toBe("hace 2 h");
    expect(hace(3 * DAY)).toBe("hace 3 d");
  });

  it("redondea hacia abajo: lo que no ha pasado no se cuenta", () => {
    expect(hace(HOUR - SECOND)).toBe("hace 59 min");
    expect(hace(2 * HOUR - SECOND)).toBe("hace 1 h");
  });

  it("pasa a semanas, meses y años", () => {
    expect(hace(WEEK)).toBe("hace 1 sem");
    expect(hace(3 * WEEK)).toBe("hace 3 sem");
    expect(hace(31 * DAY)).toBe("hace 1 mes");
    expect(hace(70 * DAY)).toBe("hace 2 meses");
    expect(hace(400 * DAY)).toBe("hace 1 año");
    expect(hace(800 * DAY)).toBe("hace 2 años");
  });

  it("una fecha en el futuro es «ahora mismo»", () => {
    // Pasa cuando el reloj del navegador va por detrás del motor. «Dentro de
    // 3 s» en una lista de Proyectos solo parecería un error.
    expect(relativeTime(new Date(NOW.getTime() + 5 * MINUTE), NOW)).toBe(
      "hace un momento",
    );
  });
});

/**
 * `dateTimeLabel` se prueba con fechas LOCALES (`new Date(a, m, d, h, min)`) y
 * no con cadenas ISO, al revés que `relativeTime`. No es un descuido de estilo:
 * lo que decide esta función es en qué DÍA DE CALENDARIO cayó algo, y el
 * calendario del que se habla es el del reloj de quien mira la pantalla.
 */
describe("dateTimeLabel", () => {
  const HOY = new Date(2026, 8, 5, 16, 0);

  it("lo de hoy se dice por la hora", () => {
    expect(dateTimeLabel(new Date(2026, 8, 5, 14, 32), HOY)).toBe("hoy 14:32");
    expect(dateTimeLabel(new Date(2026, 8, 5, 9, 4), HOY)).toBe("hoy 09:04");
  });

  it("lo de ayer se dice por el día, aunque haga cuarenta minutos", () => {
    // El caso que descarta contar 24 horas: a las 00:30 de hoy, lo de las
    // 23:50 de anoche pasó hace cuarenta minutos y aun así fue AYER. Decir
    // «hoy 23:50» sobre algo que no pasó hoy es lo único que no vale.
    const medianoche = new Date(2026, 8, 5, 0, 30);
    expect(dateTimeLabel(new Date(2026, 8, 4, 23, 50), medianoche)).toBe("ayer 23:50");
    expect(dateTimeLabel(new Date(2026, 8, 4, 19, 5), HOY)).toBe("ayer 19:05");
  });

  it("más atrás, dentro del año, se dice por el día y el mes", () => {
    expect(dateTimeLabel(new Date(2026, 8, 2, 11, 48), HOY)).toBe("2 sep · 11:48");
    expect(dateTimeLabel(new Date(2026, 0, 31, 8, 0), HOY)).toBe("31 ene · 08:00");
  });

  it("de otro año, el año se dice: es lo que lo distingue", () => {
    expect(dateTimeLabel(new Date(2025, 11, 11, 9, 20), HOY)).toBe("11 dic 2025 · 09:20");
  });

  it("el cambio de año no convierte diciembre en «ayer» de enero", () => {
    // Un 1 de enero, lo del 31 de diciembre es de ayer Y de otro año. Manda el
    // día: «ayer» es más útil que el año, y el año ya se dirá pasado mañana.
    const anoNuevo = new Date(2026, 0, 1, 10, 0);
    expect(dateTimeLabel(new Date(2025, 11, 31, 22, 15), anoNuevo)).toBe("ayer 22:15");
  });
});
