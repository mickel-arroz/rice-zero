# Fuentes locales

Todas las fuentes se sirven en local vía `next/font/local` (cero CDNs). El único
punto de entrada es `index.ts`; los componentes nunca importan fuentes directamente.

| Archivo | Familia | Origen |
| --- | --- | --- |
| `Ndot57-Regular.woff2` | NDot 57 | [xeji01/nothingfont](https://github.com/xeji01/nothingfont) (`fonts/Ndot57-Regular.otf`) |
| `NType82-Regular.woff2` | NType 82 | [xeji01/nothingfont](https://github.com/xeji01/nothingfont) (`fonts/NType82-Regular.otf`) |
| `NType82-Headline.woff2` | NType 82 Headline | [xeji01/nothingfont](https://github.com/xeji01/nothingfont) (`fonts/NType82-Headline.otf`) |
| `Iosevka-Regular.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-400-normal.woff2`) |
| `Iosevka-Bold.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-700-normal.woff2`) |

Conversión OTF → WOFF2 de NDot/NType con `fonttools` (`font.flavor = "woff2"`);
los WOFF2 de Iosevka vienen ya empaquetados por Fontsource (subset latin, cubre español).

Licencias: Iosevka es SIL OFL 1.1. NDot/NType son fuentes propietarias de
Nothing Technology redistribuidas por el repo `xeji01/nothingfont`; uso en
proyecto personal sin fines comerciales.
