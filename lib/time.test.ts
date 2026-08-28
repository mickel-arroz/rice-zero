import { describe, expect, it } from "vitest";

import { relativeTime } from "@/lib/time";

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
