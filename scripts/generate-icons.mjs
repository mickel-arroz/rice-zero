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
  /**
   * «R0» para el favicon: 4+3 columnas y 5 filas, la matriz más pequeña en la
   * que las dos siguen siendo esas dos letras.
   *
   * Estrechas por MEDIDA. En una pestaña el icono se ve a 16 px, y el paso lo
   * fija el lado más largo de la matriz: con la R de 5 columnas y el cero de 5
   * —las de la marca grande— son 11 columnas y cada punto queda en 1,4 px, que
   * el antialiasing funde en un borrón. Con 8 columnas el punto sube a 1,9 y en
   * una pantalla HiDPI —donde esos 16 son 32 reales— a 3,8: ahí se leen.
   *
   * La R pierde la pata diagonal y la resuelve con un escalón; el cero pierde
   * las esquinas redondeadas y queda rectangular. Los dos son lo que hace
   * cualquier tipografía de matriz al bajar de cuerpo.
   */
  rCorta: ["1110", "1001", "1110", "1010", "1001"],
  ceroEstrecho: ["111", "101", "101", "101", "111"],
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
 * La marca del favicon: «R0», sin paréntesis.
 *
 * No puede ser `WORDMARK`: en una pestaña el icono se ve a 16 px, y ahí las 19
 * columnas del wordmark dejan cada punto en 0,47 px. Eso no es la marca en
 * pequeño, es un borrón gris. Por eso el favicon lleva su propia reducción.
 *
 * Los paréntesis son lo primero que cae. Son seis columnas de las once que
 * costaría `R(0)` —más de la mitad del ancho— para dos glifos que a este tamaño
 * se leen como dos rayas, y su trabajo es decir que el cero es un cero: eso ya
 * lo dice ir detrás de la R. Sin ellos caben las DOS letras, que era lo que
 * faltaba — antes iba solo el cero, y un anillo suelto no es una marca.
 */
const FAVICON_MARK = [GLYPH.rCorta, GLYPH.ceroEstrecho];

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
 * @param options.dotRatio diámetro del punto como fracción del paso.
 * @param options.corner radio de las esquinas como fracción del lado. Con `0`
 *   sale el cuadrado de siempre, que es lo que quiere el `maskable`.
 * @param options.snap cuadra el paso y el margen a píxeles enteros. Ver abajo.
 */
function markSvg(
  size,
  inset,
  mark,
  { dotRatio = DOT_RATIO, corner = CORNER_RATIO, snap = false } = {},
) {
  const columns = columnsOf(mark);
  const rows = rowsOf(mark);
  // El paso lo fija el lado más apretado de la matriz. Con el wordmark manda
  // el ancho (19 columnas contra 7 filas) y da igual cuál se use; con una marca
  // estrecha manda el alto, y dividir por las columnas la desbordaría por
  // arriba en vez de encogerla.
  const exact = (size * inset) / Math.max(columns, rows);
  // A tamaño de pestaña el paso EXACTO es lo que emborrona la marca. Con 16 px
  // sale 1,9: cada punto cae en un sitio distinto dentro de su píxel, ninguno
  // llena uno entero, y las dos letras se funden en una mancha gris. Cuadrado a
  // 2 px enteros —paso y margen— cada punto ocupa siempre las mismas casillas y
  // la R vuelve a ser una R.
  //
  // Solo lo pide el favicon: de 180 px para arriba la parte decimal del paso es
  // ruido frente al tamaño del punto, y redondear ahí solo movería la marca.
  const pitch = snap ? Math.max(1, Math.round(exact)) : exact;
  const radius = (pitch * dotRatio) / 2;
  const place = (count) => {
    const start = (size - pitch * count) / 2;
    return snap ? Math.round(start) : start;
  };
  const left = place(columns);
  const top = place(rows);
  const circles = dots(mark)
    .map(({ x, y }) => {
      const cx = (left + (x + 0.5) * pitch).toFixed(2);
      const cy = (top + (y + 0.5) * pitch).toFixed(2);
      return `<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}" fill="${INK}"/>`;
    })
    .join("");
  const rx = (size * corner).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="${PAPER}"/>${circles}</svg>`;
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

/**
 * Cuánto se redondean las esquinas del lienzo, como fracción del lado.
 *
 * El #27 decidió DEJARLAS CUADRADAS —«los sistemas operativos ya recortan el
 * icono, y hacerlo dos veces produce un borde sobrante»— y esto lo revierte a
 * petición explícita. La decisión no era falsa, era parcial: vale para el
 * `maskable`, donde Android recorta de verdad, y no vale para la pestaña del
 * navegador ni para el acceso directo de Windows, que pintan el PNG tal cual y
 * dejan un cuadrado negro perfecto donde todo lo demás va redondeado.
 *
 * 0,18 y no el 0,2237 del squircle de iOS: ese está calculado para que la
 * curva se coma el borde del icono ENTERO, y aquí la marca vive dentro. A 16 px
 * son 2,9 px de radio: se nota que está redondeado sin que el cero pierda su
 * esquina.
 */
const CORNER_RATIO = 0.18;

const png = (size, inset, mark, options) =>
  sharp(Buffer.from(markSvg(size, inset, mark, options)))
    .png({ compressionLevel: 9 })
    .toBuffer();

/** Debe coincidir con `APP_ICONS` y `APPLE_TOUCH_ICON` de `lib/pwa/manifest.ts`. */
const OUTPUTS = [
  { file: "icon-192.png", px: 192, inset: 0.78 },
  { file: "icon-512.png", px: 512, inset: 0.78 },
  // El maskable se aparta más: Android recorta a la forma del launcher y solo
  // garantiza el 80 % central. Y es el ÚNICO que sigue cuadrado: el recorte lo
  // pone el sistema, y redondear aquí además dejaría el borde sobrante que el
  // #27 quería evitar.
  { file: "icon-maskable-512.png", px: 512, inset: 0.66, corner: 0 },
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

/**
 * El favicon casi no deja margen: a 16 px cada píxel de borde cuenta.
 *
 * 0,9 y no 0,95 por el redondeo: con el paso cuadrado a píxeles enteros, 0,95
 * empuja el de 48 px de 5 a 6 y la marca sale a ras de los cuatro bordes, justo
 * donde ahora hay una esquina redondeada que morder.
 */
const FAVICON_INSET = 0.9;

/**
 * El punto del favicon va más gordo que el de la marca.
 *
 * A 16 px el hueco de 0,28 del paso que deja `DOT_RATIO` no llega a un píxel,
 * así que no separa nada y solo resta brillo: el punto sale gris en vez de
 * blanco. Con el paso ya cuadrado a 2 px, el punto que llena el paso entero es
 * el único que llena sus casillas; cualquier fracción vuelve a repartir brillo
 * entre píxeles vecinos. Los puntos quedan tangentes, que en una matriz de
 * puntos es lo que se espera ver.
 */
const FAVICON_DOT_RATIO = 1;

const iconsDir = path.join(process.cwd(), "public", "icons");
await mkdir(iconsDir, { recursive: true });

// El SVG fuente se versiona junto a los PNG: es lo que se abre para mirar la
// marca sin tener que descomprimir un mapa de bits.
await writeFile(
  path.join(iconsDir, "icon.svg"),
  markSvg(512, 0.78, WORDMARK),
  "utf8",
);

for (const { file, px, inset, corner } of OUTPUTS) {
  await writeFile(
    path.join(iconsDir, file),
    await png(px, inset, WORDMARK, { corner }),
  );
  console.log(`icons/${file}  ${px}x${px}`);
}

const favicon = path.join(process.cwd(), "app", "favicon.ico");
await writeFile(
  favicon,
  ico(
    await Promise.all(
      FAVICON_SIZES.map(async (px) => ({
        px,
        png: await png(px, FAVICON_INSET, FAVICON_MARK, {
          dotRatio: FAVICON_DOT_RATIO,
          snap: true,
        }),
      })),
    ),
  ),
);
console.log(`app/favicon.ico  ${FAVICON_SIZES.join(", ")}`);
