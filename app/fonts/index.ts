import localFont from "next/font/local";

/**
 * Módulo único de fuentes (issue #3). Toda la app consume las fuentes vía
 * las variables CSS de aquí y los tokens de Tailwind en globals.css:
 * cambiar una fuente solo toca este archivo (y el token si cambia el nombre).
 *
 * Jerarquía Nothing OS:
 * - NDot 57   → display (h1, cifras grandes)
 * - Iosevka   → todo lo demás: headings, cuerpo, prompts y código (regular + bold)
 */

const ndot = localFont({
  src: "./Ndot57-Regular.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-ndot57",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
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

export const fontVariables = `${ndot.variable} ${iosevka.variable}`;
