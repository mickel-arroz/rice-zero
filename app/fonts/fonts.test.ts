/**
 * El PESO de las fuentes, medido en disco.
 *
 * Mismo gesto que `lib/pwa/manifest.test.ts` con los PNG de la PWA: mira el
 * archivo de verdad, no una constante que alguien escribió al lado. Es lo único
 * que convierte «ya no parpadea» —que no se puede afirmar— en un número que sí.
 *
 * Existe porque el retraso visible de la tipografía no venía de que las fuentes
 * fueran remotas: ya eran locales. Venía del peso — Iosevka completa son ~965 KB
 * por variante, casi dos megas entre las dos, y `font-display: swap` enseña el
 * fallback hasta que llegan. Recortarlas a lo que esta app escribe las deja en
 * menos de la quinta parte. Ver `scripts/subset-fonts.mjs`.
 *
 * ⚠ Este test es el que impide que alguien vuelva a poner un archivo completo
 * sin darse cuenta. Si algún día hace falta más cobertura de la que cabe bajo
 * el tope, lo que hay que mover es el tope —y escribir por qué—, no borrar el
 * test.
 */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FONTS = path.join(process.cwd(), "app", "fonts");

/**
 * Lo que puede pesar cada archivo de la tipografía de cuerpo.
 *
 * 250 KB no es un número redondo elegido a ojo: es aproximadamente lo que tarda
 * en llegar en menos de un segundo por una conexión móvil mala, que es el
 * escenario en el que el cambio de fuente se ve. Las dos variantes recortadas
 * caben con margen (~188 KB), y el margen es a propósito — un tope justo se
 * rompería con el primer glifo que haga falta añadir.
 */
const MAX_BODY_FONT_BYTES = 250 * 1024;

/** Todas las fuentes que la app carga, tal y como están en disco. */
function fontFiles(): string[] {
  return readdirSync(FONTS).filter((name) => name.endsWith(".woff2"));
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

describe("el peso de las fuentes", () => {
  it("hay exactamente tres archivos, y son los que declara `index.ts`", () => {
    // Un archivo suelto que nadie carga sigue pesando en el repositorio, y uno
    // que falte rompe la app sin que este test diga nada del peso.
    expect(fontFiles().sort()).toEqual([
      "Iosevka-Bold.woff2",
      "Iosevka-Regular.woff2",
      "Ndot57-Regular.woff2",
    ]);
  });

  it.each(["Iosevka-Regular.woff2", "Iosevka-Bold.woff2"])(
    "%s pesa menos de 250 KB",
    (name) => {
      const bytes = statSync(path.join(FONTS, name)).size;
      expect(
        bytes,
        `${name} pesa ${kb(bytes)}. Vuelve a pasar scripts/subset-fonts.mjs.`,
      ).toBeLessThan(MAX_BODY_FONT_BYTES);
    },
  );

  it("la de display no necesita recorte: es una matriz de puntos", () => {
    // La NDot solo tiene el alfabeto que dibuja, así que ya nace pequeña. Se
    // afirma de todas formas para que sustituirla por una completa se note.
    const bytes = statSync(path.join(FONTS, "Ndot57-Regular.woff2")).size;
    expect(bytes).toBeLessThan(64 * 1024);
  });

  it("todas juntas caben en lo que antes ocupaba media variante", () => {
    // La cifra que de verdad se nota: lo que hay que descargar antes de que la
    // tipografía definitiva pueda aparecer.
    const total = fontFiles().reduce(
      (sum, name) => sum + statSync(path.join(FONTS, name)).size,
      0,
    );
    expect(total, `Las tres suman ${kb(total)}`).toBeLessThan(512 * 1024);
  });
});
