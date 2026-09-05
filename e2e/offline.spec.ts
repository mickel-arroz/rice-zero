/**
 * Sin conexión: la edición se bloquea, la consulta no, y lo tecleado no se
 * pierde.
 *
 * Es el único criterio del #20 que ninguna prueba de unidad puede cerrar. Las
 * decisiones puras ya están probadas —`components/connection/connection.ts` y
 * `pending.ts` tienen sus tests—, pero «la app entera se comporta así cuando de
 * verdad no hay red» solo se puede afirmar apagándole la red a un navegador de
 * verdad, que es lo que hace `context.setOffline`.
 *
 * ── La ventana de 500 ms ─────────────────────────────────────────────────
 *
 * El Autoguardado espera `NODE_TEXT_DEBOUNCE_MS` (500 ms) desde la última
 * tecla. Para que un borrador quede RETENIDO hay que cortar la red dentro de
 * esa ventana, así que abajo se escribe y se corta sin nada en medio: `fill`
 * pone el texto de una vez y `setOffline` es un solo viaje al navegador. No es
 * un adorno del orden de las líneas — meter una aserción entre las dos haría
 * que el borrador se guardara antes de cortar y la prueba dejaría de probar lo
 * que dice.
 */

import { expect, test } from "@playwright/test";

import {
  campoAbierto,
  crearYAbrir,
  esperarGuardado,
  nodoPorTexto,
  nombreUnico,
  primerNodo,
} from "@/e2e/apoyo/pantallas";
import {
  APP_NAME,
  CONNECTION_COPY,
  PROJECTS_COPY,
  ROUTES,
  TREE_COPY,
  VERSIONS_COPY,
} from "@/lib/constants";

test("sin red no se edita, y al volver se edita otra vez", async ({ page, context }) => {
  await crearYAbrir(page, nombreUnico("offline"));
  await primerNodo(page, "Escrito con red");

  // ── Se corta ────────────────────────────────────────────────────────────
  await context.setOffline(true);

  const franja = page.getByRole("status").filter({ hasText: CONNECTION_COPY.offline });
  await expect(franja).toBeVisible();
  // Dice lo que NO se puede y lo que SÍ, en ese orden, y que se reintenta solo.
  await expect(franja.getByText(CONNECTION_COPY.offlineBody)).toBeVisible();
  await expect(franja.getByText(CONNECTION_COPY.retrying)).toBeVisible();

  // Los botones que ESCRIBEN se apagan. No es que fallen al pulsarlos: es que
  // no se pueden pulsar, que es la diferencia entre avisar antes y avisar
  // después de haber escrito un párrafo.
  await expect(page.getByRole("button", { name: TREE_COPY.newRoot })).toBeDisabled();
  await nodoPorTexto(page, "Escrito con red").click();
  await expect(page.getByRole("button", { name: TREE_COPY.actions.child })).toBeDisabled();
  await expect(page.getByRole("button", { name: TREE_COPY.actions.remove })).toBeDisabled();
  // Seleccionar SÍ se puede: de eso viven el borrado y el movimiento que se
  // harán al volver la red. Lo que no se puede es abrir el campo.
  await expect(page.getByRole("button", { name: TREE_COPY.actions.deselect })).toBeEnabled();

  // ── Vuelve ──────────────────────────────────────────────────────────────
  await context.setOffline(false);

  const vuelta = page.getByRole("status").filter({ hasText: CONNECTION_COPY.back });
  await expect(vuelta).toBeVisible();
  await expect(vuelta.getByText(CONNECTION_COPY.backBody)).toBeVisible();

  // Se apaga sola —nadie la cierra— y la edición ya responde.
  await expect(vuelta).toBeHidden();
  await expect(page.getByRole("button", { name: TREE_COPY.newRoot })).toBeEnabled();
});

test("lo tecleado justo antes del corte queda Pendiente y se escribe al volver", async ({
  page,
  context,
}) => {
  await crearYAbrir(page, nombreUnico("pendiente"));
  await primerNodo(page, "Antes");

  // `escribirNodo` deja el campo cerrado y el Nodo seleccionado, así que un
  // solo toque lo vuelve a abrir (ver `node-row.tsx`).
  await nodoPorTexto(page, "Antes").click();
  const campo = campoAbierto(page);
  await expect(campo).toBeVisible();

  // Sin nada en medio: ver la cabecera del archivo.
  await campo.fill("Antes y algo más");
  await context.setOffline(true);

  // «Pendiente» y no «Guardado»: hay algo escrito, no está guardado, y saldrá
  // solo. Es el cuarto estado del pie, y existe para que no mienta justo aquí.
  // `exact` porque el título del Proyecto también lleva la palabra dentro.
  await expect(
    page.getByText(CONNECTION_COPY.savePending, { exact: true }),
  ).toBeVisible();
  // Lo tecleado sigue en la pantalla: el campo es `readOnly`, no `disabled`,
  // porque sin red eso puede ser lo único que quede de la idea.
  await expect(campo).toHaveValue("Antes y algo más");

  await context.setOffline(false);
  await esperarGuardado(page);

  // Y llegó de verdad al motor, no solo al pie.
  await page.reload();
  await expect(nodoPorTexto(page, "Antes y algo más")).toBeVisible();
});

test("sin red, crear un Proyecto está apagado", async ({ page, context }) => {
  await page.goto(ROUTES.projects);
  await expect(page.getByRole("button", { name: PROJECTS_COPY.newProject }).first()).toBeEnabled();

  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: PROJECTS_COPY.newProject }).first(),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: PROJECTS_COPY.newProject }).first(),
  ).toBeEnabled();
});

/**
 * La otra mitad del estado: sin red la app sigue siendo la app.
 *
 * ── Lo que esta prueba NO afirma, y por qué ──────────────────────────────
 *
 * No afirma que el ÁRBOL se vea. Por el ADR 0001 el navegador pide los Nodos
 * directamente al Data API del Proveedor de Backend, que es otro origen, y esa
 * respuesta no la guarda el service worker a propósito: `lib/pwa/cache.ts` deja
 * fuera del logout —y por tanto fuera de lo que sobrevive— todo lo que pueda
 * llevar datos de alguien dentro. Sin red, el árbol no se puede traer.
 *
 * Lo que sí se afirma es la diferencia que de verdad importa al usuario: que
 * una recarga sin conexión devuelve LA APP —su cascarón, su franja, su
 * explicación en español— y no el dinosaurio del navegador ni una pantalla en
 * blanco. Eso es lo que sirve el worker (#18), y es afirmable sin fingir que la
 * app guarda datos que decidió no guardar.
 */
test("sin red, una recarga sigue devolviendo la app", async ({ page, context }) => {
  const titulo = nombreUnico("consulta");
  await crearYAbrir(page, titulo);
  await primerNodo(page, "Guardado en la caché");

  // Que el worker esté ACTIVO, y que esta ruta haya pasado por él con red:
  // `cacheOnNavigation` guarda lo que se navega, y la primera carga pudo ser
  // anterior al registro.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

  const url = page.url();
  await context.setOffline(true);
  await page.reload();

  // Sigue siendo la misma ruta: no rebotó a `/offline`, que es la pantalla de
  // lo que NUNCA se abrió con red.
  expect(page.url()).toBe(url);

  // El cascarón está entero: la marca y los accesos directos salen de la caché
  // del worker, no de la red.
  await expect(page.getByRole("link", { name: APP_NAME })).toBeVisible();

  // Y lo que falta se dice en NUESTRA pantalla, en español y con su botón —no
  // el dinosaurio del navegador—. Quien lo dice son las VERSIONES y no el
  // árbol: `VersionGate` va delante, así que es la primera que se queda sin
  // red. Ver `components/versions/version-gate.tsx`.
  await expect(page.getByText(VERSIONS_COPY.errorTitle)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: TREE_COPY.retry })).toBeVisible();

  // La franja de arriba no se afirma aquí: quien la enciende es el detector de
  // Next, que se entera cuando le falla una petición SUYA, y una página servida
  // entera desde la caché puede no hacer ninguna. Que aparece al caerse la red
  // ya lo afirma la primera prueba del archivo, que es donde ocurre la
  // transición.
});
