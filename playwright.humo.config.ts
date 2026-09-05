/**
 * El smoke del despliegue: ¿está la app en pie ahí fuera?
 *
 * Corre contra una URL que YA está desplegada —`SMOKE_URL`, típicamente la de
 * Vercel— y no levanta ningún servidor. De ahí que sea una configuración
 * aparte y no un proyecto más de `playwright.config.ts`: aquella construye la
 * app entera antes de la primera prueba, y hacerlo para ir a mirar una URL
 * remota sería esperar cinco minutos por nada. Mismo criterio que
 * `vitest.live.config.ts` frente a `vitest.config.ts`.
 *
 * ── Lo que este smoke NO hace ────────────────────────────────────────────
 *
 * No entra con ninguna cuenta y no escribe NADA. Es producción: los datos que
 * hay ahí son de personas. Todo lo que se comprueba es público —la landing,
 * `/about`, el manifest, el service worker— más la única afirmación que
 * importa sobre lo privado: que sin sesión no se entra. Con eso se cazan los
 * fallos que de verdad trae un despliegue —una variable de entorno que no se
 * copió, el proxy caído, el worker sin publicar— sin tocar un solo Proyecto.
 */

import { defineConfig, devices } from "@playwright/test";

import { objetivoDeHumo } from "./e2e/apoyo/entorno";

/**
 * ── De dónde salen las variables ─────────────────────────────────────────
 *
 * Del ENTORNO, ya cargado. Quien lee `.env.local` es `scripts/smoke.mjs` antes de
 * lanzar esto, y el proceso hijo hereda lo que aquél cargó — por eso aquí no se
 * llama a `loadEnvLocal()`: Playwright transpila los `.mjs` a CommonJS para
 * cargar su configuración, y ese cargador usa `import.meta.url`, que en
 * CommonJS es un error de sintaxis.
 *
 * Consecuencia: `npx playwright test` a pelo NO ve `.env.local`. No se queda en
 * silencio: `objetivoDeHumo` deja `baseURL` sin poner y la primera prueba se
 * rompe— pero el camino bueno es `npm run smoke`.
 */

/**
 * Se resuelve al CARGAR la configuración, así que un `SMOKE_URL` mal escrito
 * rompe aquí y no en silencio. Ver `objetivoDeHumo`.
 */
const OBJETIVO = objetivoDeHumo(process.env);

export default defineConfig({
  testDir: "e2e/humo",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /**
   * Dos reintentos siempre, también en local.
   *
   * Al revés que la suite de casa, y por lo que hay en medio: aquí entre el
   * navegador y la app hay internet, un CDN y un arranque en frío de una
   * función. Un fallo que no se repite dos veces no es un despliegue roto.
   */
  retries: 2,
  reporter: "list",

  use: {
    baseURL: OBJETIVO ?? undefined,
    trace: "on-first-retry",
    locale: "es-ES",
  },

  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "movil", use: { ...devices["Pixel 5"] } },
  ],
});
