/**
 * Acceso y cuenta: la puerta de la app.
 *
 * Es el único archivo que arranca SIN sesión — los demás heredan la que dejó
 * `e2e/preparar/cuenta.setup.ts`—, y por eso es el que puede afirmar las tres
 * cosas del spec que solo se ven desde fuera: que lo público se ve sin entrar,
 * que lo protegido no, y que entrar funciona.
 */

import { expect, test } from "@playwright/test";

import { credenciales } from "@/e2e/apoyo/entorno";
import { literal } from "@/e2e/apoyo/texto";
import {
  conNavegacionAbierta,
  entrarConEmail,
  pulsarHidratado,
} from "@/e2e/apoyo/pantallas";
import {
  APP_NAME,
  AUTH_COPY,
  NEXT_PARAM,
  PROJECTS_COPY,
  ROUTES,
  SHELL_COPY,
} from "@/lib/constants";

/**
 * La landing, en absoluto: `waitForURL` con una ruta relativa la resuelve
 * contra `baseURL`, pero `/` sola casaría con cualquier cosa.
 */
const BASE_LANDING = new RegExp(`^https?://[^/]+${ROUTES.home}$`);

/**
 * El login CON su parámetro, que es lo que distingue «rebotó» de «entró».
 *
 * Escrito una vez: en línea, dentro de un literal de plantilla, `\?` se colapsa
 * a `?` y el patrón pasa a significar «/logi» más una «n» opcional. Pasaba, y
 * pasaba por accidente.
 */
const RUTA_DE_LOGIN = new RegExp(`${literal(ROUTES.login)}\\?`);

/** Sin cookies: el estado guardado por la preparación no entra aquí. */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("sin sesión", () => {
  test("la landing y /about se ven sin entrar", async ({ page }) => {
    await page.goto(ROUTES.home);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto(ROUTES.about);
    await expect(page).toHaveURL(new RegExp(`${ROUTES.about}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("una ruta del dashboard manda a login, y se acuerda de a dónde ibas", async ({
    page,
  }) => {
    await page.goto(ROUTES.projects);

    await page.waitForURL(RUTA_DE_LOGIN);
    // El `next` no es un adorno: es lo que hace que después de entrar la app
    // devuelva a la pantalla que se pidió y no a la lista de siempre.
    const destino = new URL(page.url()).searchParams.get(NEXT_PARAM);
    expect(destino).toBe(ROUTES.projects);

    await expect(
      page.getByRole("heading", { name: AUTH_COPY.signIn.title, level: 1 }),
    ).toBeVisible();
  });

  test("crear cuenta con un email ya registrado lo dice, y no inventa una sesión", async ({
    page,
  }) => {
    const { email, password } = credenciales(process.env);

    await page.goto(ROUTES.login);
    // Cambiar de pestaña ES el clic que prueba que React ya escucha: hasta que
    // no lo hace, «Crear cuenta» no aparece como título.
    await pulsarHidratado(
      page.getByRole("tab", { name: AUTH_COPY.signUp.tab }),
      page.getByRole("heading", { name: AUTH_COPY.signUp.title, level: 1 }),
    );

    const enviar = page.getByRole("button", {
      name: AUTH_COPY.signUp.submit,
      exact: true,
    });
    await page.getByLabel(AUTH_COPY.emailLabel).fill(email);
    await page
      .getByLabel(AUTH_COPY.signUp.passwordLabel, { exact: true })
      .fill(password);
    await page.getByLabel(AUTH_COPY.confirmLabel, { exact: true }).fill(password);
    await enviar.click();

    // La cuenta de la suite ya existe: el camino que se prueba aquí es que el
    // fallo se DICE, que es lo que separa un formulario honesto de uno que se
    // queda pensando. El alta desde cero la hace la preparación.
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(ROUTES.login));
  });

  test("entrar con email y contraseña lleva a Proyectos", async ({ page }) => {
    const { email, password } = credenciales(process.env);

    await page.goto(`${ROUTES.login}?${NEXT_PARAM}=${ROUTES.projects}`);
    await entrarConEmail(page, email, password);

    await page.waitForURL(`**${ROUTES.projects}`);
    await expect(
      page.getByRole("heading", { name: PROJECTS_COPY.title, level: 1 }),
    ).toBeVisible();
  });

  /**
   * ── Hasta dónde llega Google aquí ────────────────────────────────────────
   *
   * Hasta el ARRANQUE, y ni un paso más: lo que viene después es la pantalla
   * de consentimiento de Google, que no es nuestra, cambia sin avisarnos y
   * pediría una cuenta de Google de verdad. Lo que sí es nuestro —y lo que se
   * afirma— es que el botón le pide al Proveedor de Backend un login social
   * con Google y le dice a dónde volver.
   *
   * La respuesta del proveedor se LEE pero no se le pasa al navegador: con la
   * URL en la mano, la app saldría hacia el dominio de Google y la suite
   * dependería de un tercero para pasar.
   */
  test("el botón de Google arranca el login social y manda a Google", async ({
    page,
  }) => {
    const pedidos: string[] = [];
    const respuestas: string[] = [];

    await page.route("**/api/auth/sign-in/social**", async (route) => {
      pedidos.push(route.request().postData() ?? "");
      const respuesta = await route.fetch();
      respuestas.push(await respuesta.text());
      // Se contesta al navegador con lo que vino, salvo que NO se le deja
      // seguir: la app recibiría la URL y saldría hacia el dominio de Google,
      // y entonces la suite dependería de un tercero para pasar. Lo que se
      // afirma es lo que contestó NUESTRO proxy, que es lo que es nuestro.
      await route.fulfill({ response: respuesta, body: "{}" });
    });

    await page.goto(ROUTES.login);
    await page.getByRole("button", { name: AUTH_COPY.google }).click();

    await expect.poll(() => pedidos.length).toBeGreaterThan(0);
    const cuerpo = JSON.parse(pedidos[0]) as {
      provider?: string;
      callbackURL?: string;
    };
    expect(cuerpo.provider).toBe("google");
    // Absoluta: el proveedor redirige desde SU dominio, así que una ruta
    // relativa no le serviría de vuelta. Ver `withGoogle` en `login-form.tsx`.
    expect(cuerpo.callbackURL).toMatch(/^https?:\/\/.+\/projects$/);

    // Y el proveedor contesta con un redirect a SU puerta del login social —
    // que es la que luego lleva a Google—. Se afirma eso y no el dominio de
    // Google porque eso ya es cosa de Neon: nuestra app recibe esta URL y sale
    // hacia ella, y ahí acaba lo que este repo controla.
    //
    // Si esto falla, lo más probable es que el origen de la corrida no esté
    // registrado en Neon Auth (ver `scripts/setup-neon.sh`) o que Google no
    // esté activado allí.
    await expect.poll(() => respuestas.length).toBeGreaterThan(0);
    const salida = JSON.parse(respuestas[0]) as { url?: string; redirect?: boolean };
    expect(salida.redirect).toBe(true);
    expect(salida.url ?? "").toContain("/sign-in/social/init");
  });
});

/**
 * Cerrar sesión, con una sesión PROPIA.
 *
 * No hereda la que dejó `e2e/preparar/cuenta.setup.ts`, y es la corrección de un
 * fallo real: al heredarla, esta prueba REVOCABA la sesión que las otras
 * cuarenta estaban usando en ese mismo momento —la suite corre en paralelo— y
 * todas empezaban a fallar con «Authentication required» en sitios que no
 * tenían nada que ver. Una prueba que destruye estado compartido tiene que
 * traerse el suyo.
 */
test.describe("cerrar sesión", () => {
  test("devuelve a la landing y cierra la puerta", async ({ page }) => {
    const { email, password } = credenciales(process.env);
    const nombre = email.split("@")[0];

    await page.goto(ROUTES.login);
    await entrarConEmail(page, email, password);
    await page.waitForURL(`**${ROUTES.projects}`);

    // El disparador de la cuenta se pide por su FORMA y no por su nombre: lo
    // acompaña un avatar que aporta su propio texto alternativo, así que el
    // nombre accesible es «e2e e2e» y no «e2e». Los tres puntos de una tarjeta
    // también son un `haspopup`, pero no llevan texto dentro.
    const cuenta = await conNavegacionAbierta(
      page,
      page.locator('button[aria-haspopup="menu"]').filter({ hasText: nombre }),
    );
    await cuenta.click();
    await page.getByRole("menuitem", { name: SHELL_COPY.signOut }).click();

    // A la LANDING, no al login: es lo que hace `use-sign-out.ts`, y tiene
    // sentido — quien se va no quiere un formulario delante.
    await expect(page).toHaveURL(BASE_LANDING);

    // Y la puerta queda cerrada de verdad: volver a pedir la ruta protegida
    // rebota. Sin esto, la prueba solo diría que la app navegó.
    await page.goto(ROUTES.projects);
    await page.waitForURL(RUTA_DE_LOGIN);
  });
});

test("el nombre de la app está donde tiene que estar", async ({ page }) => {
  await page.goto(ROUTES.home);
  await expect(page).toHaveTitle(new RegExp(literal(APP_NAME)));
});
