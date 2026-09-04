import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { APPLE_TOUCH_ICON, APP_ICONS, appManifest } from "@/lib/pwa/manifest";
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
