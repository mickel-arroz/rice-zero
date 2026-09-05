/**
 * Versiones: clonar es copiar, no ramificar.
 *
 * La promesa que se prueba aquí es la más fácil de romper sin que nadie se
 * entere: «editar el clon no toca ésta, y no hay forma de volver a unirlas»
 * (`CONTEXT.md`, «sin merge, nunca»). Una prueba que solo mirara que el clon
 * nace con los mismos Nodos no diría nada de eso — hay que escribir en uno y
 * volver a mirar el otro.
 */

import { expect, test } from "@playwright/test";

import {
  crearYAbrir,
  escribirNodo,
  nodoPorTexto,
  nombreUnico,
  primerNodo,
} from "@/e2e/apoyo/pantallas";
import { TREE_COPY, VERSIONS_COPY } from "@/lib/constants";

test("clonar copia el árbol, y a partir de ahí las dos van por su cuenta", async ({
  page,
}) => {
  await crearYAbrir(page, nombreUnico("clonable"));
  await primerNodo(page, "Tronco común");

  const urlOriginal = page.url();

  // ── Clonar ──────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: VERSIONS_COPY.open }).click();
  await page.getByRole("menuitem", { name: VERSIONS_COPY.cloneCurrent }).click();

  const dialogo = page.getByRole("dialog", { name: VERSIONS_COPY.cloneTitle(1) });
  // El diálogo dice cuánto se copia y qué NO se copia: las dos cosas son parte
  // de la promesa, no adorno.
  await expect(dialogo.getByText(VERSIONS_COPY.cloneNodes(1))).toBeVisible();
  await expect(dialogo.getByText(VERSIONS_COPY.cloneAnalyses)).toBeVisible();

  await dialogo.getByLabel(VERSIONS_COPY.labelField).fill("Rumbo B");
  await dialogo.getByRole("button", { name: VERSIONS_COPY.cloneSubmit }).click();

  await expect(dialogo).toBeHidden();

  // Clonar deja abierta la Versión nueva, con el árbol ya copiado.
  await expect(page).not.toHaveURL(urlOriginal);
  await expect(nodoPorTexto(page, "Tronco común")).toBeVisible();
  // Acotado al selector: los títulos que inventa `nombreUnico` viven en la
  // sidebar y una chapa de dos letras se encuentra dentro de cualquiera.
  await expect(
    page.getByRole("button", { name: VERSIONS_COPY.open }),
  ).toContainText(TREE_COPY.versionChip(2));

  // ── Independientes ──────────────────────────────────────────────────────
  await nodoPorTexto(page, "Tronco común").click();
  await page.getByRole("button", { name: TREE_COPY.actions.child }).click();
  await escribirNodo(page, "Solo en el clon");

  await page.goto(urlOriginal);
  await expect(nodoPorTexto(page, "Tronco común")).toBeVisible();
  await expect(page.getByText("Solo en el clon")).toBeHidden();
  await expect(page.getByText(TREE_COPY.nodeCount(1))).toBeVisible();
});

test("la URL lleva la Versión, así que recargar devuelve la que estabas mirando", async ({
  page,
}) => {
  await crearYAbrir(page, nombreUnico("url-version"));
  await primerNodo(page, "Original");
  const urlOriginal = page.url();

  await page.getByRole("button", { name: VERSIONS_COPY.open }).click();
  await page.getByRole("menuitem", { name: VERSIONS_COPY.cloneCurrent }).click();
  const dialogo = page.getByRole("dialog", { name: VERSIONS_COPY.cloneTitle(1) });
  await dialogo.getByRole("button", { name: VERSIONS_COPY.cloneSubmit }).click();
  await expect(dialogo).toBeHidden();

  // Clonar navega con `router.push`, que NO ha terminado cuando el diálogo se
  // cierra: sin esperar al cambio, lo que se guardaba aquí era la URL de la
  // Versión de partida y la prueba se afirmaba a sí misma.
  await expect(page).not.toHaveURL(urlOriginal);
  const urlDelClon = page.url();
  await page.reload();

  // Sin la Versión en la URL, esto habría vuelto a «la más reciente» y la
  // prueba pasaría por accidente: por eso se compara la URL, no el contenido.
  expect(page.url()).toBe(urlDelClon);
  await expect(
    page.getByRole("button", { name: VERSIONS_COPY.open }),
  ).toContainText(TREE_COPY.versionChip(2));
});
