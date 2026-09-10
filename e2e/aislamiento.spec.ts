/**
 * Ninguna petición del navegador sale hacia el proveedor.
 *
 * Es el criterio de aceptación del ADR 0006 escrito como prueba, y es el único
 * sitio donde se puede afirmar: la contract suite sobre el loopback demuestra
 * que el cable no deforma nada, pero no puede ver a dónde apunta un `fetch` de
 * verdad. Aquí hay un navegador de verdad y se le escucha todo lo que pide.
 *
 * Lo que se vigila no es «el host de Neon» sino CUALQUIER origen que no sea el
 * nuestro, con dos excepciones nombradas. Es a propósito: una lista de hosts
 * prohibidos se queda corta el día que alguien cambie de proveedor, mientras
 * que «solo hablamos con nosotros mismos» sigue siendo cierto para siempre.
 *
 * También se mira que el JWT no viaje. Que la URL del Data API no esté en el
 * bundle no basta: lo que un XSS se lleva es el token, y la razón de que esta
 * suite exista es que ya no hay ninguno que llevarse.
 */

import { expect, test, type Page, type Request } from "@playwright/test";

import {
  abrirProyecto,
  crearYAbrir,
  escribirNodo,
  esperarGuardado,
  nombreUnico,
  primerNodo,
} from "@/e2e/apoyo/pantallas";
import { ROUTES } from "@/lib/constants";

/**
 * Orígenes que el navegador puede tocar sin que esto sea un fallo.
 *
 * Ninguno lleva datos del usuario dentro: son la foto de perfil que pinta
 * `components/ui/avatar.tsx` con un `<img>` crudo desde el proveedor social, y
 * el `about:blank`/`data:` que el propio navegador se pide a sí mismo.
 */
const PERMITIDOS = [/^https:\/\/lh\d\.googleusercontent\.com\//, /^data:/, /^blob:/];

function esAjena(request: Request, origen: string): boolean {
  const url = request.url();
  if (url.startsWith(origen)) return false;
  return !PERMITIDOS.some((permitido) => permitido.test(url));
}

/**
 * Escucha todo lo que pide la página y devuelve lo que no debería haber pedido.
 *
 * Se engancha a `request` y no a `response`: una petición que sale y falla
 * también salió, y es exactamente igual de mala.
 */
function vigilar(page: Page, origen: string): { ajenas: string[]; conToken: string[] } {
  const ajenas: string[] = [];
  const conToken: string[] = [];

  page.on("request", (request) => {
    if (esAjena(request, origen)) ajenas.push(`${request.method()} ${request.url()}`);

    // Un JWT tiene tres segmentos separados por punto. No se decodifica ni se
    // imprime: solo se comprueba que no está.
    const auth = request.headers()["authorization"];
    if (auth && /^Bearer\s+[\w-]+\.[\w-]+\.[\w-]+$/.test(auth)) {
      conToken.push(`${request.method()} ${request.url()}`);
    }
  });

  return { ajenas, conToken };
}

test("un recorrido completo no habla con nadie más que con esta app", async ({
  page,
  baseURL,
}) => {
  const origen = new URL(baseURL!).origin;
  const { ajenas, conToken } = vigilar(page, origen);

  // El recorrido toca los cuatro repositorios: Proyectos (listar, crear),
  // Versiones (listar), Nodos (crear, editar, listar) y la Búsqueda.
  const titulo = nombreUnico("aislamiento");
  await crearYAbrir(page, titulo);
  await primerNodo(page, "Una idea que se guarda");
  await escribirNodo(page, "Y otra debajo");
  await esperarGuardado(page);

  await page.goto(ROUTES.projects);
  await abrirProyecto(page, titulo);

  expect(
    ajenas,
    "el navegador pidió algo fuera de esta app; el ADR 0006 dice que no debe",
  ).toEqual([]);

  expect(
    conToken,
    "salió un bearer token del navegador; ya no debería existir ninguno",
  ).toEqual([]);
});

/**
 * El endpoint que canjeaba la cookie por un JWT. Cerrarlo es lo que hace verdad
 * la ganancia principal del ADR: sin esto, un XSS se lleva una credencial
 * portátil con una línea, y da igual que el cliente de datos ya no exista.
 */
test("el endpoint del JWT ya no se puede canjear desde el navegador", async ({
  page,
  baseURL,
}) => {
  // Con la sesión abierta: el estado de sesión lo siembra `e2e/preparar`.
  await page.goto(ROUTES.projects);

  const status = await page.evaluate(async (url) => {
    const response = await fetch(url, { credentials: "include" });
    return response.status;
  }, new URL(`${ROUTES.authApi}/token`, baseURL!).toString());

  expect(status, "una sesión viva no debe poder canjearse por un JWT").toBe(404);
});
