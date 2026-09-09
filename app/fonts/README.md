# Fuentes locales

Todas las fuentes se sirven en local vía `next/font/local` (cero CDNs). El único
punto de entrada es `index.ts`; los componentes nunca importan fuentes directamente.

| Archivo | Familia | Origen |
| --- | --- | --- |
| `Ndot57-Regular.woff2` | NDot 57 | [xeji01/nothingfont](https://github.com/xeji01/nothingfont) (`fonts/Ndot57-Regular.otf`) |
| `Iosevka-Regular.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-400-normal.woff2`) |
| `Iosevka-Bold.woff2` | Iosevka | [`@fontsource/iosevka@5.3.0`](https://www.npmjs.com/package/@fontsource/iosevka) (`iosevka-latin-700-normal.woff2`) |

Conversión OTF → WOFF2 de NDot con `fonttools` (`font.flavor = "woff2"`);
los WOFF2 de Iosevka vienen empaquetados por Fontsource.

## Por qué están recortadas (#51)

Los dos archivos de Iosevka llegan de Fontsource pesando ~965 KB cada uno: su
subset «latin» sigue trayendo miles de glifos que esta app no escribe. Con
`font-display: swap`, eso son casi dos megas por delante del momento en que la
tipografía definitiva puede aparecer — y ése era el cambio visible, no el hecho
de que las fuentes fueran remotas, que ya no lo eran.

`scripts/subset-fonts.mjs` los recorta a los rangos Unicode que la app puede
llegar a enseñar. Se ejecuta **a mano** y su salida se commitea, igual que los
iconos de la PWA: es una transformación de un asset que no cambia, y meterla en
el build pondría `fonttools` —que es Python— en el camino de `next build`.

| Archivo | Antes | Ahora |
| --- | --- | --- |
| `Iosevka-Regular.woff2` | 961,0 KB | 187,3 KB |
| `Iosevka-Bold.woff2` | 965,2 KB | 188,9 KB |

El tope lo vigila `fonts.test.ts`, midiendo el archivo en disco. Se conservan
1047 glifos por variante: latín acentuado entero, la puntuación tipográfica que
la interfaz usa, monedas, flechas, operadores matemáticos y marcas de
verificación. De MÁS a propósito — el texto de un Nodo lo escribe una persona, y
un carácter que falte no da error: cae al fallback y se ve distinto en mitad de
una frase.

Para volver a generarlos hace falta `pip install fonttools brotli`.

Licencias: Iosevka es SIL OFL 1.1. NDot es una recreación hecha por
fans (repo `xeji01/nothingfont`), muy similar a la fuente de Nothing OS
pero independiente; sin restricciones legales conocidas.
