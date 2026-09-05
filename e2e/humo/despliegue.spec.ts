/**
 * El smoke del despliegue, en seis afirmaciones.
 *
 * Cada una caza una clase de fallo que SOLO se ve después de desplegar, y
 * ninguna toca datos de nadie. Ver la cabecera de `playwright.humo.config.ts`.
 *
 *     SMOKE_URL=https://… npm run smoke
 */

import { expect, test } from "@playwright/test";

import { literal } from "@/e2e/apoyo/texto";
import {
  APP_NAME,
  AUTH_COPY,
  NEXT_PARAM,
  ROUTES,
  SERVICE_WORKER_URL,
} from "@/lib/constants";

test("la landing responde y se pinta", async ({ page }) => {
  const respuesta = await page.goto(ROUTES.home);

  expect(respuesta?.status()).toBe(200);
  await expect(page).toHaveTitle(new RegExp(literal(APP_NAME)));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("/about responde y se pinta", async ({ page }) => {
  const respuesta = await page.goto(ROUTES.about);

  expect(respuesta?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/**
 * La única afirmación sobre lo privado, y la más importante de las seis: un
 * despliegue al que le falte `NEON_AUTH_COOKIE_SECRET` o la URL del proveedor
 * no puede validar sesiones, y esto es lo que lo destapa.
 */
test("sin sesión, el dashboard rebota a login", async ({ page }) => {
  await page.goto(ROUTES.projects);

  await page.waitForURL(new RegExp(`${literal(ROUTES.login)}\\?`));
  expect(new URL(page.url()).searchParams.get(NEXT_PARAM)).toBe(ROUTES.projects);
  await expect(
    page.getByRole("heading", { name: AUTH_COPY.signIn.title, level: 1 }),
  ).toBeVisible();
});

/**
 * El manifest es el fallo que no se ve en ninguna pantalla: si el proxy lo
 * gateara, el navegador recibiría el HTML del login donde espera JSON y
 * simplemente dejaría de ofrecer «instalar», sin un solo error visible.
 */
test("el manifest se sirve y dice quién es la app", async ({ request }) => {
  const respuesta = await request.get(ROUTES.manifest);

  expect(respuesta.status()).toBe(200);
  const manifest = (await respuesta.json()) as {
    name?: string;
    start_url?: string;
    display?: string;
  };
  expect(manifest.name).toBe(APP_NAME);
  expect(manifest.start_url).toBe(ROUTES.projects);
  expect(manifest.display).toBe("standalone");
});

/**
 * Y el worker, que es el otro. Lo compila un Route Handler con esbuild fuera
 * del build (ver `app/serwist/[path]/route.ts`), así que es justo la clase de
 * pieza que un despliegue puede dejarse.
 */
test("el service worker se sirve como JavaScript", async ({ request }) => {
  const respuesta = await request.get(SERVICE_WORKER_URL);

  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toContain("javascript");
  // Y no es el HTML del login disfrazado: eso también devolvería 200.
  expect(await respuesta.text()).not.toContain("<!DOCTYPE html>");
});

/**
 * La ruta de auth existe y la contesta NUESTRO servidor.
 *
 * Se pide la sesión, que sin cookies es «no hay»: no muta nada y no necesita
 * credenciales. Lo que se afirma es que el proxy de `/api/auth` está montado —
 * si el Proveedor de Backend no estuviera configurado, esto sería un 500 o el
 * 404 de «no monta un handler de auth».
 */
test("la ruta de auth está montada", async ({ request }) => {
  const respuesta = await request.get(`${ROUTES.authApi}/get-session`);

  expect(respuesta.status()).toBeLessThan(400);
  expect(respuesta.headers()["content-type"]).toContain("json");
});
