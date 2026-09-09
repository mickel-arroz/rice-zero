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
 * dejan al navegador eligiendo, y cuál elige no está escrito en ninguna parte.
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

    // La que publica `viewport.themeColor` es UNA y no lleva `media` desde #55,
    // así que basta con reescribirla. Se busca en cada pase y no se guarda: el
    // router de Next rehace la cabecera al navegar, y una referencia cacheada
    // apuntaría a una etiqueta que ya no está en el documento.
    const tag = document.head.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (tag) tag.content = color;
  }, [resolvedTheme]);

  return null;
}
