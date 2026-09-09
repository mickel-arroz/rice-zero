/**
 * Recorta la tipografía de cuerpo a lo que esta app escribe.
 *
 *     node scripts/subset-fonts.mjs
 *
 * Iosevka completa pesa ~965 KB por variante —casi dos megas entre las dos—
 * porque cubre cirílico, griego, kana, formas de construcción de cajas y varios
 * miles de símbolos. RICE(0) se escribe en español y enseña texto que escriben
 * personas: de todo eso usa una fracción.
 *
 * Lo que se conserva está en `KEEP`, y se conserva de MÁS a propósito: el texto
 * de un Nodo lo escribe alguien, y un carácter que falte no da error — cae al
 * fallback y se ve distinto en medio de una frase, que es peor que unos
 * kilobytes de más. Por eso entran el latín acentuado entero, la puntuación
 * tipográfica que la interfaz ya usa («» · … — ✓) y los signos de una fórmula o
 * un fragmento de código pegado dentro de un Nodo.
 *
 * ⚠ Se ejecuta A MANO y su salida se commitea, igual que los iconos de la PWA:
 * es una transformación de un asset que no cambia nunca, y meterla en el build
 * pondría a fontTools —que es Python— en el camino de `next build`.
 *
 * Requiere `fonttools` y `brotli` (`pip install fonttools brotli`).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const FONTS = path.join(process.cwd(), "app", "fonts");

/**
 * Los rangos Unicode que se conservan.
 *
 * En rangos y no en la lista de caracteres que la interfaz usa hoy: la copia de
 * la app cabría en doscientos glifos, pero el CONTENIDO no es nuestro. Recortar
 * a lo que hoy dice la interfaz dejaría a alguien escribiendo «≥» dentro de un
 * Nodo y viéndolo en otra fuente.
 */
const KEEP = [
  "U+0020-007E", // ASCII imprimible: la base de todo
  "U+00A0-00FF", // Latín-1: acentos, ñ, ¿, ¡, º, ª, €, ×, ÷
  "U+0100-017F", // Latín extendido A: por si aparece algo europeo
  "U+02C6-02DC", // Modificadores sueltos que arrastran algunas fuentes
  "U+2010-2027", // Guiones, comillas tipográficas, puntos suspensivos, ·
  "U+2030-205E", // ‰, ‹›, ⁄, y el resto de la puntuación general
  "U+20A0-20BF", // Símbolos de moneda
  "U+2100-214F", // ™, №, ℓ…
  "U+2190-21BB", // Flechas: → aparece en la copia y en los prompts
  "U+2200-22FF", // Operadores matemáticos: ≤ ≥ ≠ ∑ ∞
  "U+2500-2503", // Las cuatro líneas de caja que dibujan un árbol en texto
  "U+2514-2534", // └ ├ ─ ┬: el árbol serializado, si alguien lo pega
  "U+25A0-25FF", // ■ ● ▲: viñetas
  "U+2600-26FF", // ✓ ✗ y compañía
  "U+2705-27BF", // Marcas de verificación y flechas decorativas
].join(",");

/** Un archivo, recortado sobre sí mismo. */
function subset(name) {
  const file = path.join(FONTS, name);
  const before = statSync(file).size;
  const out = `${file}.subset`;

  execFileSync(
    "python",
    [
      "-m",
      "fontTools.subset",
      file,
      `--unicodes=${KEEP}`,
      "--layout-features=*",
      // Los nombres se conservan: sin ellos algunas herramientas dejan de
      // reconocer la familia, y `next/font/local` los usa para el `@font-face`.
      "--name-IDs=*",
      "--flavor=woff2",
      `--output-file=${out}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  renameSync(out, file);
  const after = statSync(file).size;
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(
    `${name}: ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)} % menos)`,
  );
}

for (const name of ["Iosevka-Regular.woff2", "Iosevka-Bold.woff2"]) {
  subset(name);
}

// La NDot ya pesa 5,7 KB: es una matriz de puntos con el alfabeto justo, y no
// hay nada que recortarle.
console.log(
  `Ndot57-Regular.woff2: ${(readFileSync(path.join(FONTS, "Ndot57-Regular.woff2")).length / 1024).toFixed(1)} KB, sin tocar`,
);
