/**
 * La Vista Canvas, y la frontera que la parte en dos.
 *
 * En escritorio se edita; en el teléfono es SOLO consulta (`CONTEXT.md`). Son
 * dos comportamientos distintos del mismo botón, así que este archivo tiene una
 * prueba por formato en vez de una que valga para los dos: una prueba que
 * pasara igual en los dos no estaría afirmando la diferencia, que es justo lo
 * que hay que afirmar.
 *
 * La separación se hace con `isMobile` del propio Playwright y no con el ancho
 * de la ventana: la app pregunta por `(min-width: 64rem) and (hover: hover)`, y
 * lo segundo no se emula estirando una ventana.
 */

import { expect, test } from "@playwright/test";

import { crearYAbrir, nombreUnico, primerNodo } from "@/e2e/apoyo/pantallas";
import { CANVAS_COPY, TREE_COPY } from "@/lib/constants";

test("alternar a Canvas enseña el mismo árbol, sin recargar ni perder nada", async ({
  page,
}) => {
  await crearYAbrir(page, nombreUnico("canvas"));
  await primerNodo(page, "Una idea en el lienzo");

  await page.getByRole("button", { name: TREE_COPY.views.canvas, exact: true }).click();

  const lienzo = page.getByLabel(CANVAS_COPY.canvasLabel);
  await expect(lienzo).toBeVisible();
  await expect(lienzo.getByText("Una idea en el lienzo")).toBeVisible();

  // Y de vuelta. Alternar es estado de la pantalla, no una navegación: el
  // árbol sigue en pie sin volver a pedirlo.
  await page
    .getByRole("button", { name: TREE_COPY.views.registro, exact: true })
    .click();
  await expect(page.getByText(TREE_COPY.nodeCount(1))).toBeVisible();
});

test("la vista elegida se recuerda al volver al Proyecto", async ({ page }) => {
  await crearYAbrir(page, nombreUnico("recuerda"));
  await primerNodo(page, "Persistente");

  await page.getByRole("button", { name: TREE_COPY.views.canvas, exact: true }).click();
  await expect(page.getByLabel(CANVAS_COPY.canvasLabel)).toBeVisible();

  // La cookie por Proyecto (`lib/shell/tree-view.ts`) es lo que hace que el
  // servidor pinte la vista correcta en el PRIMER HTML, sin salto.
  await page.reload();
  await expect(page.getByLabel(CANVAS_COPY.canvasLabel)).toBeVisible();
});

test.describe("en el teléfono el Canvas no edita", () => {
  test.skip(({ isMobile }) => !isMobile, "Es la regla del formato móvil.");

  test("lo dice, y no ofrece la barra de acciones", async ({ page }) => {
    await crearYAbrir(page, nombreUnico("solo-consulta"));
    await primerNodo(page, "Se lee, no se toca");

    await page.getByRole("button", { name: TREE_COPY.views.canvas, exact: true }).click();

    await expect(page.getByText(CANVAS_COPY.readOnly)).toBeVisible();
    // La barra de acciones no se monta: sin ella, no hay «Subnodo» que pulsar.
    await expect(
      page.getByRole("button", { name: TREE_COPY.actions.child }),
    ).toBeHidden();
  });
});

test.describe("en escritorio el Canvas sí edita", () => {
  test.skip(({ isMobile }) => !!isMobile, "Aquí el Canvas es solo consulta.");

  test("no lleva la marca de solo consulta", async ({ page }) => {
    await crearYAbrir(page, nombreUnico("canvas-edita"));
    await primerNodo(page, "Editable");

    await page.getByRole("button", { name: TREE_COPY.views.canvas, exact: true }).click();
    await expect(page.getByLabel(CANVAS_COPY.canvasLabel)).toBeVisible();

    await expect(page.getByText(CANVAS_COPY.readOnly)).toBeHidden();
    // Los controles del lienzo sí están, en los dos formatos: mirar se puede.
    await expect(page.getByRole("button", { name: CANVAS_COPY.fit })).toBeVisible();
  });
});
