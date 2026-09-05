/**
 * Lo que pasa UNA vez, antes de la primera prueba.
 *
 * Deja tres cosas: la cuenta de usar y tirar registrada, su email confirmado y
 * su lista de Proyectos vacía; y encima de eso, una sesión iniciada guardada en
 * disco que reutilizan las demás pruebas.
 *
 * Es un «setup project» de Playwright y no un `globalSetup`, y la diferencia
 * importa: un `globalSetup` corre ANTES de que `webServer` levante la app, y
 * aquí hace falta la app —el registro pasa por `/api/auth`, que es una ruta de
 * ESTE servidor (ADR 0002)—. Como proyecto del que dependen los demás, corre
 * como una prueba normal, con la app ya en pie y con `expect` disponible.
 */

import { expect, test as preparar } from "@playwright/test";

import { ESTADO_SESION, credenciales, faltantes } from "@/e2e/apoyo/entorno";
import { entrarConEmail } from "@/e2e/apoyo/pantallas";
import { sembrar } from "@/e2e/apoyo/semilla";
import { PROJECTS_COPY, ROUTES } from "@/lib/constants";

/**
 * Códigos con los que Better Auth dice «ese email ya está registrado».
 *
 * Los mismos que traduce `lib/backend/adapters/neon/auth.ts`. Aquí NO son un
 * fallo: la cuenta se registra la primera vez y sobrevive a las corridas
 * siguientes, que es justo lo que se quiere — lo que se rehace cada vez es su
 * CONTENIDO, no su existencia.
 */
const YA_REGISTRADO = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

/**
 * Nada de esto se reintenta ni se paraleliza: es una preparación, no una
 * prueba. Un segundo intento volvería a vaciar la cuenta con las pruebas ya
 * corriendo.
 */
preparar.describe.configure({ mode: "serial", retries: 0 });

preparar("la cuenta existe, está confirmada y está vacía", async ({ page, request }) => {
  const ausentes = faltantes(process.env);
  // Se comprueba aquí y no solo en el script de arranque porque a Playwright se
  // le puede llamar directamente (`npx playwright test`), y entonces el guardia
  // de `scripts/e2e.mjs` no ha corrido.
  expect(
    ausentes,
    `La suite E2E no está configurada. Faltan: ${ausentes.join(", ")}. Ver .env.example.`,
  ).toEqual([]);

  const { email, password } = credenciales(process.env);

  // ── 1. Que la cuenta exista ────────────────────────────────────────────
  //
  // Por HTTP contra nuestra propia ruta de auth y no por el formulario: el
  // formulario acabaría en «revisa tu correo», que es una pantalla que esta
  // preparación no necesita atravesar. Que ESO funcione lo prueba
  // `acceso.spec.ts`.
  const alta = await request.post(`${ROUTES.authApi}/sign-up/email`, {
    // Better Auth exige un nombre y el puerto no lo tiene: la parte local del
    // email, igual que hace el adaptador (`nameFromEmail`).
    data: { email, password, name: email.split("@")[0] },
    failOnStatusCode: false,
  });

  if (!alta.ok()) {
    const cuerpo = (await alta.json().catch(() => ({}))) as { code?: string };
    expect(
      YA_REGISTRADO.has(cuerpo.code ?? ""),
      `No se pudo registrar «${email}»: ${alta.status()} ${JSON.stringify(cuerpo)}`,
    ).toBe(true);
  }

  // ── 2. Confirmarla y vaciarla ──────────────────────────────────────────
  const { proyectosBorrados } = await sembrar(process.env.DATABASE_URL ?? "", email);
  // Solo informativo, pero se dice: una corrida que arranca borrando nueve
  // Proyectos avisa de que la anterior se murió a la mitad.
  preparar.info().annotations.push({
    type: "semilla",
    description: `Proyectos borrados antes de empezar: ${proyectosBorrados}`,
  });

  // ── 3. Entrar, y guardar la sesión ─────────────────────────────────────
  //
  // Por el formulario y no por HTTP: la sesión que las demás pruebas van a usar
  // tiene que ser exactamente la que la app fabrica —una cookie httpOnly de
  // primera parte que sienta `/api/auth` (ADR 0002)—, y la única forma de estar
  // seguros de eso es sacarla por donde la saca un usuario.
  await page.goto(ROUTES.login);
  await entrarConEmail(page, email, password);

  await page.waitForURL(`**${ROUTES.projects}`);
  await expect(
    page.getByRole("heading", { name: PROJECTS_COPY.title, level: 1 }),
  ).toBeVisible();

  await page.context().storageState({ path: ESTADO_SESION });
});
