import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  APPLE_TOUCH_ICON,
  APP_ICONS,
  THEME_COLORS,
  appManifest,
} from "@/lib/pwa/manifest";
import { ROUTES } from "@/lib/constants";

const icons = () => appManifest().icons ?? [];

const sizes = () => icons().map((icon) => icon.sizes);

describe("appManifest", () => {
  it("cumple los mínimos de instalabilidad", () => {
    const manifest = appManifest();
    // Los cuatro que Chrome exige para ofrecer «instalar». No salen de leer la
    // implementación: son los criterios del navegador, y por eso el test los
    // repite en vez de comparar el objeto entero contra una copia.
    expect(manifest.name).toBeTruthy();
    expect(manifest.display).toBe("standalone");
    expect(sizes()).toContain("192x192");
    expect(sizes()).toContain("512x512");
  });

  it("trae un icono maskable", () => {
    // Sin `maskable`, Android recorta el icono a su forma y se come el glifo:
    // el sistema no sabe qué parte puede sacrificar.
    expect(icons().some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("declara todos sus iconos como PNG servidos desde public", () => {
    for (const icon of icons()) {
      expect(icon.type).toBe("image/png");
      expect(icon.src.startsWith("/icons/")).toBe(true);
    }
    // Los que promete el manifest y los que se generan son la misma lista.
    expect(icons().map((icon) => icon.src)).toEqual(
      APP_ICONS.map((icon) => icon.src),
    );
  });

  it("arranca en el dashboard, dentro de su propio alcance", () => {
    const manifest = appManifest();
    // Una app instalada no abre en la landing: quien la instaló ya decidió.
    expect(manifest.start_url).toBe(ROUTES.projects);
    expect(manifest.scope).toBe("/");
  });

  it("usa un short_name que cabe bajo un icono", () => {
    // Android recorta la etiqueta de la pantalla de inicio alrededor de 12
    // caracteres. Un short_name más largo sale con puntos suspensivos.
    expect(appManifest().short_name!.length).toBeLessThanOrEqual(12);
  });
});

/** El lado de un PNG, leido de su cabecera IHDR (bytes 16..24, big-endian). */
function pngSize(src: string) {
  const bytes = readFileSync(path.join(process.cwd(), "public", src));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("los archivos de los iconos", () => {
  it("existen y miden lo que el manifest promete", () => {
    // El manifest promete URLs y tamaños; nada comprueba que detrás haya un
    // archivo, ni que mida lo que se dijo. Un icono que falta no da error: el
    // navegador se calla y deja de ofrecer «instalar». Y el tamaño esperado
    // sale del propio `sizes` del manifest, así que esto compara lo que la app
    // DICE contra lo que hay en el disco, no dos copias del mismo número.
    for (const icon of [...APP_ICONS, APPLE_TOUCH_ICON]) {
      expect(pngSize(icon.src), icon.src).toBe(icon.sizes);
    }
  });
});

/**
 * `oklch(L C H)` en hexadecimal.
 *
 * Existe para que el test pueda comparar lo que dice `globals.css` con lo que
 * dice el manifest, que es lo único que impide que se desincronicen: el CSS
 * habla en `oklch()` porque es donde vive el tema, y el manifest no lo entiende
 * —ni él ni una etiqueta `<meta>`— así que el color está escrito dos veces por
 * fuerza. Lo que no puede pasar es que las dos escrituras dejen de decir lo
 * mismo sin que nadie se entere.
 *
 * Los dos colores de la app son grises puros (`C = 0`), así que basta con la
 * rama acromática: con croma cero, oklab deja los tres canales lineales
 * iguales a `L³`, y lo único que queda es la curva de transferencia de sRGB.
 * Un conversor completo sería más código del que este test necesita, y código
 * que nadie ejercitaría.
 */
function achromaticOklchToHex(lightness: number): string {
  const linear = lightness ** 3;
  const channel =
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  const byte = Math.round(Math.min(Math.max(channel, 0), 1) * 255);
  const pair = byte.toString(16).padStart(2, "0");
  return `#${pair}${pair}${pair}`;
}

/** La `--background` declarada dentro de un selector de `globals.css`. */
function backgroundLightness(selector: string): number {
  const css = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
  const block = css.slice(css.indexOf(`${selector} {`));
  const declared = /--background:\s*oklch\(([\d.]+)/.exec(block);
  if (!declared) throw new Error(`No hay --background bajo «${selector}»`);
  return Number(declared[1]);
}

describe("el arranque es oscuro desde el primer píxel", () => {
  it("el splash de la PWA es el fondo del tema oscuro", () => {
    // `background_color` es lo que el sistema pinta ANTES de que exista un
    // píxel nuestro. Declarado claro, abrir la app instalada enseñaba una
    // pantalla blanca que parecía la app cargando y era el splash.
    const manifest = appManifest();

    expect(manifest.background_color).toBe(
      achromaticOklchToHex(backgroundLightness(".dark")),
    );
    expect(manifest.theme_color).toBe(manifest.background_color);
  });

  it("y los dos colores de `THEME_COLORS` siguen siendo los del CSS", () => {
    // El manifest y `viewport.themeColor` leen de aquí; `globals.css` es la
    // fuente. Esto es lo que hace que tocar el tema y no tocar el hexadecimal
    // rompa un test en vez de dejar la app con un splash de otro color.
    expect(THEME_COLORS.dark).toBe(
      achromaticOklchToHex(backgroundLightness(".dark")),
    );
    expect(THEME_COLORS.light).toBe(
      achromaticOklchToHex(backgroundLightness(":root")),
    );
  });
});
