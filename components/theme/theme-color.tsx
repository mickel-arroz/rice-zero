"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import { THEMES } from "@/lib/constants";
import { THEME_COLORS } from "@/lib/pwa/manifest";

/**
 * Mantiene el color de la barra de estado de acuerdo con el tema que se ve.
 *
 * `viewport.themeColor` de `app/layout.tsx` publica la etiqueta con la que
 * arranca, y no puede hacer más: el servidor no sabe qué tema eligió esta
 * persona —la elección vive en `localStorage`— así que declara el oscuro, que
 * es el de por defecto y por tanto el que acierta la primera vez.
 *
 * Lo que falta es lo que pasa DESPUÉS de tocar el conmutador. Sin esto, elegir
 * el tema claro dejaba la barra del sistema en oscuro sobre una app clara: una
 * franja que contradice a la pantalla que tiene debajo, y que solo se ve en la
 * app instalada, que es donde nadie la va a ir a buscar.
 *
 * Escribe la etiqueta que ya existe en vez de añadir otra: dos `theme-color`
 * sin media query dejan al navegador eligiendo, y cuál elige no está escrito en
 * ninguna parte.
 *
 * No pinta nada. Va montado dentro del proveedor de tema, que es de donde saca
 * el tema resuelto.
 */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Antes de hidratar no hay tema resuelto: se deja la etiqueta del servidor,
    // que ya trae el oscuro. Escribir `undefined` aquí la borraría por un
    // fotograma.
    if (!resolvedTheme) return;

    const color =
      resolvedTheme === THEMES.light ? THEME_COLORS.light : THEME_COLORS.dark;

    // Las que publica `viewport.themeColor` llevan `media`, así que se les
    // quita: una etiqueta con media query solo se aplica cuando su consulta
    // acierta, y lo que manda ahora es la elección de la persona, no el sistema.
    const tags = document.head.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (tags.length === 0) return;

    for (const [index, tag] of tags.entries()) {
      tag.removeAttribute("media");
      // Solo la primera se queda: dos `theme-color` sin media dejan la decisión
      // al navegador.
      if (index === 0) tag.content = color;
      else tag.remove();
    }
  }, [resolvedTheme]);

  return null;
}
