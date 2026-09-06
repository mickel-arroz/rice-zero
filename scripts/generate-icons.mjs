/**
 * Genera los iconos de la app desde la marca corta «R(0)», en matriz de puntos.
 *
 * Se lanza a mano (`node scripts/generate-icons.mjs`) y los archivos se
 * versionan: no es un paso del build. El manifest los promete por URL, así que
 * tienen que existir en `public/` antes de desplegar, y un paso de build que
 * puede fallar en el sitio de otro no es sitio para eso.
 *
 * Salen de aquí dos cosas con destinos distintos:
 *
 * - Los iconos de la PWA, a `public/icons/`. Los declara `lib/pwa/manifest.ts`.
 * - El favicon, a `app/favicon.ico`. Ese NO va en `public/`: es una convención
 *   de archivo de Next y solo funciona en la raíz de `app/`. Nadie lo declara
 *   —ni el manifest ni `metadata`—; Next lo encuentra y emite el `<link>` él.
 *
 * Los puntos se dibujan a mano en vez de escribir «R(0)» con la NDot 57 real:
 * el rasterizador de sharp no ve las fuentes de `app/fonts/`, así que un `<text>`
 * saldría con la que hubiera en el sistema —o sin ninguna—. Y dibujar puntos no
 * traiciona a la NDot: la NDot ES una matriz de puntos. Lo que se pierde es su
 * trazado exacto; lo que se gana es que el icono sale igual en cualquier máquina.
 *
 * Si cambia la lista de `APP_ICONS` en `lib/pwa/manifest.ts`, hay que cambiar
 * `OUTPUTS` aquí. Lo vigila `lib/pwa/manifest.test.ts`, que compara los dos. El
 * favicon queda fuera de esa vigilancia porque queda fuera del manifest.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Negro y blanco: la marca no usa el rojo de acento. */
const INK = "#ffffff";
const PAPER = "#000000";

/**
 * Los glifos de la marca, en matriz de 7 filas: la altura de la NDot 57.
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
const GLYPH = {
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  abre: ["001", "010", "100", "100", "100", "010", "001"],
  cero: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  cierra: ["100", "010", "001", "001", "001", "010", "100"],
  /**
   * El cero en 5 filas, para el favicon. Es el único glifo que se sale de la
   * altura de la NDot, y se sale por medida, no por gusto: rasterizado a 16 px
   * el cero de 7 filas deja cada punto en 1,4 px y el antialiasing los funde en
   * un rectángulo gris. Quitando dos filas el punto sube a 2 px y la matriz
   * vuelve a leerse. Es la misma reducción que hace cualquier marca al bajar de
   * tamaño; aquí lo que se recorta son puntos.
   */
  ceroCorto: ["01110", "10001", "10001", "10001", "01110"],
};

/**
 * Diámetro de cada punto como fracción del paso.
 *
 * 0,72 es el de la marca: los puntos de la NDot se tocan casi, pero no.
 */
const DOT_RATIO = 0.72;

/** La marca entera. Es la que va en los iconos que se ven grandes. */
const WORDMARK = [GLYPH.R, GLYPH.abre, GLYPH.cero, GLYPH.cierra];

/**
 * La marca del favicon.
 *
 * No puede ser `WORDMARK`: en una pestaña el icono se ve a 16 px, y ahí las 19
 * columnas del wordmark dejan cada punto en 0,47 px. Eso no es la marca en
 * pequeño, es un borrón gris. Por eso el favicon lleva su propia reducción.
 *
 * Es el cero y no la R porque el `(0)` es lo que distingue a RICE(0) de
 * cualquier otro «Rice», y porque a este tamaño un anillo se lee como forma
 * mientras que una R de 5×7 puntos se confunde con una B o un 8.
 */
const FAVICON_MARK = [GLYPH.ceroCorto];

/** Las columnas que ocupa una marca, contando las de separación. */
function columnsOf(mark) {
  return (
    mark.reduce((total, glyph) => total + glyph[0].length, 0) + (mark.length - 1)
  );
}

/** Las filas de una marca. Todos sus glifos miden lo mismo de alto. */
function rowsOf(mark) {
  return mark[0].length;
}

/** Las coordenadas de cada punto encendido de una marca. */
function dots(mark) {
  const on = [];
  let column = 0;
  for (const glyph of mark) {
    for (let row = 0; row < glyph.length; row += 1) {
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
 * @param mark los glifos a dibujar.
 * @param dotRatio diámetro del punto como fracción del paso.
 */
function markSvg(size, inset, mark, dotRatio = DOT_RATIO) {
  const columns = columnsOf(mark);
  const rows = rowsOf(mark);
  // El paso lo fija el lado más apretado de la matriz. Con el wordmark manda
  // el ancho (19 columnas contra 7 filas) y da igual cuál se use; con una marca
  // estrecha manda el alto, y dividir por las columnas la desbordaría por
  // arriba en vez de encogerla.
  const pitch = (size * inset) / Math.max(columns, rows);
  const radius = (pitch * dotRatio) / 2;
  const left = (size - pitch * columns) / 2;
  const top = (size - pitch * rows) / 2;
  const circles = dots(mark)
    .map(({ x, y }) => {
      const cx = (left + (x + 0.5) * pitch).toFixed(2);
      const cy = (top + (y + 0.5) * pitch).toFixed(2);
      return `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}" fill="${INK}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${PAPER}"/>${circles}</svg>`;
}

/**
 * Empaqueta varios PNG en un único `.ico`.
 *
 * A mano y no con una dependencia porque el formato es una cabecera de 6 bytes,
 * una entrada de 16 por imagen y los PNG pegados detrás —un `.ico` admite PNG
 * dentro desde Vista, así que no hay que rasterizar a BMP—. Traerse un paquete
 * para escribir 22 bytes de cabecera sale más caro que escribirlos.
 *
 * @param images `{ px, png }`, de menor a mayor.
 */
function ico(images) {
  const ENTRY = 16;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado, siempre 0
  header.writeUInt16LE(1, 2); // tipo: 1 = icono (2 sería un cursor)
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * ENTRY;
  const entries = images.map(({ px, png }) => {
    const entry = Buffer.alloc(ENTRY);
    // El lado va en UN byte, así que 256 se codifica como 0. Por encima de 256
    // no hay forma de expresarlo: el formato no llega.
    entry.writeUInt8(px === 256 ? 0 : px, 0);
    entry.writeUInt8(px === 256 ? 0 : px, 1);
    entry.writeUInt8(0, 2); // colores de la paleta: ninguno, es color directo
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos de color
    entry.writeUInt16LE(32, 6); // bits por píxel: RGBA
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const png = (size, inset, mark, dotRatio) =>
  sharp(Buffer.from(markSvg(size, inset, mark, dotRatio)))
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Debe coincidir con `APP_ICONS` y `APPLE_TOUCH_ICON` de `lib/pwa/manifest.ts`. */
const OUTPUTS = [
  { file: "icon-192.png", px: 192, inset: 0.78 },
  { file: "icon-512.png", px: 512, inset: 0.78 },
  // El maskable se aparta más: Android recorta a la forma del launcher y solo
  // garantiza el 80 % central.
  { file: "icon-maskable-512.png", px: 512, inset: 0.66 },
  { file: "apple-touch-icon.png", px: 180, inset: 0.7 },
];

/**
 * Los tamaños que lleva dentro el `.ico`.
 *
 * 16 y 32 son la pestaña y la barra de marcadores; 48 lo usa Windows en el
 * acceso directo del escritorio. Sin el 256 que traía el favicon por defecto de
 * Next: a ese tamaño ya manda el icono de la PWA, y son 8 KB de un PNG que
 * nadie mira.
 */
const FAVICON_SIZES = [16, 32, 48];

/** El favicon casi no deja margen: a 16 px cada píxel de borde cuenta. */
const FAVICON_INSET = 0.95;

/**
 * El punto del favicon va más gordo que el de la marca.
 *
 * A 16 px el hueco de 0,28 del paso que deja `DOT_RATIO` no llega a un píxel,
 * así que no separa nada y solo resta brillo: el punto sale gris en vez de
 * blanco. A 0,85 el hueco sigue existiendo donde hay resolución para verlo
 * —en el 48— y a 16 px el punto llega a blanco.
 */
const FAVICON_DOT_RATIO = 0.85;

const iconsDir = path.join(process.cwd(), "public", "icons");
await mkdir(iconsDir, { recursive: true });

// El SVG fuente se versiona junto a los PNG: es lo que se abre para mirar la
// marca sin tener que descomprimir un mapa de bits.
await writeFile(
  path.join(iconsDir, "icon.svg"),
  markSvg(512, 0.78, WORDMARK),
  "utf8",
);

for (const { file, px, inset } of OUTPUTS) {
  await writeFile(path.join(iconsDir, file), await png(px, inset, WORDMARK));
  console.log(`icons/${file}  ${px}x${px}`);
}

const favicon = path.join(process.cwd(), "app", "favicon.ico");
await writeFile(
  favicon,
  ico(
    await Promise.all(
      FAVICON_SIZES.map(async (px) => ({
        px,
        png: await png(px, FAVICON_INSET, FAVICON_MARK, FAVICON_DOT_RATIO),
      })),
    ),
  ),
);
console.log(`app/favicon.ico  ${FAVICON_SIZES.join(", ")}`);
