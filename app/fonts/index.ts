import localFont from "next/font/local";

/**
 * Módulo único de fuentes (issue #3). Toda la app consume las fuentes vía
 * las variables CSS de aquí y los tokens de Tailwind en globals.css:
 * cambiar una fuente solo toca este archivo (y el token si cambia el nombre).
 *
 * Jerarquía Nothing OS:
 * - NDot 57   → display (h1, cifras grandes)
 * - NType 82  → headings h2–h5 y badges (Headline mapeada a weight 700)
 * - Iosevka   → cuerpo, prompts y código (regular + bold)
 */

const ndot = localFont({
  src: "./Ndot57-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-ndot57",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

const ntype = localFont({
  src: [
    { path: "./NType82-Regular.woff2", weight: "400", style: "normal" },
    // NType 82 no publica bold: el corte Headline cubre el peso 700.
    { path: "./NType82-Headline.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ntype82",
  display: "swap",
  fallback: ["system-ui", "arial", "sans-serif"],
});

const iosevka = localFont({
  src: [
    { path: "./Iosevka-Regular.woff2", weight: "400", style: "normal" },
    { path: "./Iosevka-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-iosevka",
  display: "swap",
  fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const fontVariables = `${ndot.variable} ${ntype.variable} ${iosevka.variable}`;
