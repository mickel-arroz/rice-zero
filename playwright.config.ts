/**
 * La suite E2E: los flujos del spec, de punta a punta, en un navegador de
 * verdad contra el Proveedor de Backend ACTIVO.
 *
 * ── Contra qué corre, y por qué contra eso ────────────────────────────────
 *
 * Contra Neon, el activo (`CONTEXT.md`). El #20 se escribió pidiendo «un
 * proyecto Supabase de prueba», antes de que el #21 dejara a Supabase como el
 * proveedor dormido; probar el dormido habría dejado sin ejercitar justo el
 * camino que se despliega. La cuenta es de usar y tirar y la semilla la vacía
 * antes de cada corrida: ver `e2e/apoyo/semilla.ts`.
 *
 * ── El Proveedor de IA es SIEMPRE el falso ───────────────────────────────
 *
 * Se fuerza abajo, en el entorno del servidor, y sin mirar lo que hubiera —el
 * mismo criterio absoluto que `vitest.setup.ts`, palabra por palabra: es la
 * diferencia entre «la suite no suele gastar cuota» y «la suite no puede
 * gastar cuota». Quien tenga `AI_PROVIDER=gemini` en su `.env.local` para
 * trabajar en el panel no se encuentra con que `npm run test:e2e` se le come el
 * free tier del día.
 *
 * ── El smoke de producción NO está aquí ──────────────────────────────────
 *
 * Vive en `playwright.humo.config.ts`, por lo mismo que las corridas en vivo de
 * Vitest tienen la suya: esta configuración LEVANTA un servidor, y el smoke
 * corre contra uno que ya está desplegado. Una sola configuración con las dos
 * cosas construiría la app entera para ir a mirar una URL de Vercel.
 */

import { defineConfig, devices } from "@playwright/test";

import { ESTADO_SESION, baseUrl } from "./e2e/apoyo/entorno";

/**
 * ── De dónde salen las variables ─────────────────────────────────────────
 *
 * Del ENTORNO, ya cargado. Quien lee `.env.local` es `scripts/e2e.mjs` antes de
 * lanzar esto, y el proceso hijo hereda lo que aquél cargó — por eso aquí no se
 * llama a `loadEnvLocal()`: Playwright transpila los `.mjs` a CommonJS para
 * cargar su configuración, y ese cargador usa `import.meta.url`, que en
 * CommonJS es un error de sintaxis.
 *
 * Consecuencia: `npx playwright test` a pelo NO ve `.env.local`. No se queda en
 * silencio — el proyecto `preparar` comprueba las variables y falla diciendo
 * cuáles faltan— pero el camino bueno es `npm run test:e2e`.
 */

const BASE_URL = baseUrl(process.env);

/**
 * Se saca de la URL para que haya UN solo sitio donde vive el puerto: escribirlo
 * a mano aquí abajo es la forma de que un día `webServer` levante un servidor en
 * un puerto y las pruebas vayan a mirar a otro.
 */
const PUERTO = new URL(BASE_URL).port || "3000";

/**
 * Un servidor propio, salvo que ya haya uno.
 *
 * Se construye la app en vez de correr `next dev` porque la mitad offline de la
 * suite depende del service worker, y el worker que se sirve en producción es
 * el que importa.
 *
 * En `localhost` y en SU PROPIO puerto, y las dos mitades importan: ver
 * `BASE_URL_POR_DEFECTO` en `e2e/apoyo/entorno.ts`, que es donde está escrito
 * por qué `127.0.0.1` no sirve y por qué el 3000 tampoco.
 *
 * `E2E_BASE_URL` es el atajo para iterar: apunta a un servidor ya levantado y
 * esto no construye nada.
 */
const servidor = process.env.E2E_BASE_URL
  ? undefined
  : {
      command: `npm run build && npx next start --port ${PUERTO}`,
      url: BASE_URL,
      /**
       * NUNCA se adopta un servidor ajeno, ni en local.
       *
       * Con `true`, Playwright se encuentra algo escuchando en el puerto y lo
       * usa sin preguntar de qué entorno salió — incluido uno con
       * `AI_PROVIDER=gemini`, que convertiría «la suite no puede gastar cuota»
       * en «la suite no suele gastar cuota». Pasó, y costó llamadas reales.
       *
       * Reaprovechar un servidor sigue siendo posible, pero hay que DECIRLO:
       * `E2E_BASE_URL`, y entonces `scripts/e2e.mjs` exige que quien lo levantó
       * haya puesto el proveedor falso.
       */
      reuseExistingServer: false,
      // Un build de Next desde frío pasa del minuto por defecto de Playwright.
      timeout: 300_000,
      stdout: "pipe" as const,
      env: {
        // `env` REEMPLAZA el entorno del hijo, no lo extiende: sin esta línea,
        // el servidor arrancaría sin nada de lo que hay en el entorno de quien
        // lanzó la suite.
        ...process.env,
        // Absoluto y a propósito, y por eso va DESPUÉS: gana sobre lo que
        // hubiera en `.env.local`. Ver el encabezado.
        AI_PROVIDER: "falso",
      } as Record<string, string>,
    };

export default defineConfig({
  testDir: "e2e",
  /**
   * Solo `.spec.ts`, y no el `**​/*.test.ts` que Playwright también aceptaría
   * por defecto: `e2e/apoyo/entorno.test.ts` es de Vitest y vive aquí al lado
   * porque prueba el módulo que tiene al lado. Dos corredores mirando el mismo
   * archivo es una mañana perdida.
   */
  testMatch: "**/*.spec.ts",
  /* El smoke corre contra un despliegue, con su propia configuración. */
  testIgnore: "**/humo/**",

  fullyParallel: true,
  /* Nadie deja un `test.only` puesto en CI. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Uno solo en CI, y libre en local.
   *
   * No es por la máquina: es por la cuenta. Todas las pruebas comparten el
   * mismo usuario contra un backend de verdad, y aunque cada una crea su propio
   * Proyecto con un nombre único, doce navegadores escribiendo a la vez contra
   * el mismo servicio de auth es la forma de volver a ver aquel 429.
   */
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    /* Solo cuando algo falló y se reintenta: una traza por prueba pesa. */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /**
     * El portapapeles, concedido de antemano.
     *
     * `navigator.clipboard.writeText` pide permiso, y sin él la promesa se
     * rompe y el panel enseña «No se copió» — que es el comportamiento
     * CORRECTO de la app (ver `prompt-actions.tsx`) y una prueba fallida por el
     * motivo equivocado.
     */
    permissions: ["clipboard-read", "clipboard-write"],
    locale: "es-ES",
  },

  projects: [
    {
      name: "preparar",
      testMatch: "**/preparar/*.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      /**
       * Escritorio: ≥1024 px y con ratón.
       *
       * Las dos cosas hacen falta. `use-desktop.ts` pregunta por
       * `(min-width: 64rem) and (hover: hover)`, así que una ventana ancha sin
       * puntero seguiría siendo «móvil» para la Vista Canvas — que en móvil es
       * solo consulta.
       */
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], storageState: ESTADO_SESION },
      dependencies: ["preparar"],
    },
    {
      /**
       * Móvil emulado: Pixel 5 sobre el mismo Chromium.
       *
       * `isMobile` y `hasTouch` son lo que hace que las consultas de medios
       * contesten como en un teléfono, y por tanto lo que hace que aquí se
       * pruebe la Vista Registro —la vista de edición en móvil— y no la otra.
       */
      name: "movil",
      use: { ...devices["Pixel 5"], storageState: ESTADO_SESION },
      dependencies: ["preparar"],
    },
  ],

  webServer: servidor,
});
