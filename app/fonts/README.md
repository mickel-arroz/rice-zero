# Fuentes locales

Todas las fuentes se sirven en local vía `next/font/local` (cero CDNs). El único
punto de entrada es `index.ts`; los componentes nunca importan fuentes directamente.

| Archivo | Familia | Origen |
| --- | --- | --- |
| `Ndot57-Regular.woff2` | NDot 57 | [xeji01/nothingfont](https://github.com/xeji01/nothingfont) (`fonts/Ndot57-Regular.otf`) |
| `Iosevka-Regular.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-400-normal.woff2`) |
| `Iosevka-Bold.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-700-normal.woff2`) |

Conversión OTF → WOFF2 de NDot con `fonttools` (`font.flavor = "woff2"`);
los WOFF2 de Iosevka vienen ya empaquetados por Fontsource (subset latin, cubre español).

Licencias: Iosevka es SIL OFL 1.1. NDot es una recreación hecha por
fans (repo `xeji01/nothingfont`), muy similar a la fuente de Nothing OS
pero independiente; sin restricciones legales conocidas.
