/**
 * Genera los iconos de la PWA desde la marca corta «R(0)», en matriz de puntos.
 *
 * Se lanza a mano (`node scripts/generate-icons.mjs`) y los PNG se versionan:
 * no es un paso del build. El manifest los promete por URL, así que tienen que
 * existir en `public/` antes de desplegar, y un paso de build que puede fallar
 * en el sitio de otro no es sitio para eso.
 *
 * Los puntos se dibujan a mano en vez de escribir «R(0)» con la NDot 57 real:
 * el rasterizador de sharp no ve las fuentes de `app/fonts/`, así que un `<text>`
 * saldría con la que hubiera en el sistema —o sin ninguna—. Y dibujar puntos no
 * traiciona a la NDot: la NDot ES una matriz de puntos. Lo que se pierde es su
 * trazado exacto; lo que se gana es que el icono sale igual en cualquier máquina.
 *
 * Si cambia la lista de `APP_ICONS` en `lib/pwa/manifest.ts`, hay que cambiar
 * `OUTPUTS` aquí. Lo vigila `lib/pwa/manifest.test.ts`, que compara los dos.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Negro y blanco: la marca no usa el rojo de acento. */
const INK = "#ffffff";
const PAPER = "#000000";

/**
 * «R(0)» en matriz de 7 filas, la altura de la NDot 57.
 *
 * Las letras son de 5 columnas y los paréntesis de 3. De 2 columnas —que es lo
 * primero que se prueba, por estrechar— un paréntesis sale como una barra con
 * una muesca: la curva necesita tres puntos para leerse. Entre glifo y glifo va
 * una columna vacía.
 *
 * El cero va sin la diagonal del cero de terminal: dentro de una matriz de
 * puntos la diagonal son tres puntos más en el hueco, y a 192 px el glifo pasa
 * a leerse como una «G». El paréntesis ya dice que es el cero.
 */
const GLYPHS = [
  ["11110", "10001", "10001", "11110", "10100", "10010", "10001"], // R
  ["001", "010", "100", "100", "100", "010", "001"], // (
  ["01110", "10001", "10001", "10001", "10001", "10001", "01110"], // 0
  ["100", "010", "001", "001", "001", "010", "100"], // )
];

const ROWS = 7;

/** Las columnas que ocupa la marca entera, contando las de separación. */
const COLUMNS =
  GLYPHS.reduce((total, glyph) => total + glyph[0].length, 0) +
  (GLYPHS.length - 1);

/** Las coordenadas de columna de cada punto encendido. */
function dots() {
  const on = [];
  let column = 0;
  for (const glyph of GLYPHS) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === "1") on.push({ x: column + col, y: row });
      }
    }
    column += glyph[0].length + 1;
  }
  return on;
}

/**
 * @param size el lado del lienzo en píxeles.
 * @param inset cuánto del lado ocupa la marca, de 0 a 1.
 */
function markSvg(size, inset) {
  const pitch = (size * inset) / COLUMNS;
  // Diámetro 0,72 del paso: los puntos de la NDot se tocan casi, pero no.
  const radius = (pitch * 0.72) / 2;
  const left = (size - pitch * COLUMNS) / 2;
  const top = (size - pitch * ROWS) / 2;
  const circles = dots()
    .map(({ x, y }) => {
      const cx = (left + (x + 0.5) * pitch).toFixed(2);
      const cy = (top + (y + 0.5) * pitch).toFixed(2);
      return `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}" fill="${INK}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${PAPER}"/>${circles}</svg>`;
}

/** Debe coincidir con `APP_ICONS` y `APPLE_TOUCH_ICON` de `lib/pwa/manifest.ts`. */
const OUTPUTS = [
  { file: "icon-192.png", px: 192, inset: 0.78 },
  { file: "icon-512.png", px: 512, inset: 0.78 },
  // El maskable se aparta más: Android recorta a la forma del launcher y solo
  // garantiza el 80 % central.
  { file: "icon-maskable-512.png", px: 512, inset: 0.66 },
  { file: "apple-touch-icon.png", px: 180, inset: 0.7 },
];

const dir = path.join(process.cwd(), "public", "icons");
await mkdir(dir, { recursive: true });

// El SVG fuente se versiona junto a los PNG: es lo que se abre para mirar la
// marca sin tener que descomprimir un mapa de bits.
await writeFile(path.join(dir, "icon.svg"), markSvg(512, 0.78), "utf8");

for (const { file, px, inset } of OUTPUTS) {
  await sharp(Buffer.from(markSvg(px, inset)))
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, file));
  console.log(`${file}  ${px}x${px}`);
}
