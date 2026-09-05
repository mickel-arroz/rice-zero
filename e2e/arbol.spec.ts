/**
 * El árbol en la Vista Registro: crear, escribir, colgar y podar.
 *
 * Es la vista de EDICIÓN en los dos formatos —en el teléfono es la única—, así
 * que este archivo corre igual en `escritorio` y en `movil`. Que la misma
 * secuencia de botones sirva en los dos es exactamente lo que el spec pide de
 * ella.
 *
 * Todo lo que se afirma aquí sobrevive a una recarga a propósito: el
 * Autoguardado promete que no hay botón de guardar, y una prueba que solo mire
 * la pantalla no distingue «persistido» de «pintado».
 */

import { expect, test } from "@playwright/test";

import {
  crearYAbrir,
  escribirNodo,
  esperarGuardado,
  nodoPorTexto,
  nombreUnico,
  primerNodo,
} from "@/e2e/apoyo/pantallas";
import { TREE_COPY } from "@/lib/constants";

test("el primer Nodo se escribe y se queda escrito", async ({ page }) => {
  await crearYAbrir(page, nombreUnico("arbol"));

  await expect(page.getByText(TREE_COPY.emptyTitle)).toBeVisible();
  await primerNodo(page, "La idea raíz");

  await page.reload();
  await expect(nodoPorTexto(page, "La idea raíz")).toBeVisible();
  await expect(page.getByText(TREE_COPY.nodeCount(1))).toBeVisible();
});

test("un Nodo cuelga de otro, y el subárbol se poda entero", async ({ page }) => {
  await crearYAbrir(page, nombreUnico("jerarquia"));

  await primerNodo(page, "Padre");

  // El Nodo recién escrito sigue seleccionado, así que la barra de acciones ya
  // está delante: colgar un subnodo es un botón, no un gesto.
  await page.getByRole("button", { name: TREE_COPY.actions.child }).click();
  await escribirNodo(page, "Hijo");

  await page.reload();
  await expect(nodoPorTexto(page, "Padre")).toBeVisible();
  await expect(nodoPorTexto(page, "Hijo")).toBeVisible();
  await expect(page.getByText(TREE_COPY.nodeCount(2))).toBeVisible();

  // Podar el padre se lleva el subárbol entero. Es la promesa del diálogo, y
  // la cumple la cascada del motor: `nodes.parent_id ... on delete cascade`.
  await nodoPorTexto(page, "Padre").click();
  await page.getByRole("button", { name: TREE_COPY.actions.remove }).click();

  const dialogo = page.getByRole("dialog", {
    name: TREE_COPY.deleteTitle(TREE_COPY.nodeLabel("Padre")),
  });
  await expect(dialogo.getByText(TREE_COPY.deleteFalls(1))).toBeVisible();
  await dialogo.getByRole("button", { name: TREE_COPY.deleteSubmit }).click();

  await expect(dialogo).toBeHidden();
  // El diálogo se cierra cuando la escritura resuelve, pero el pie es el único
  // sitio donde consta que el árbol releído ya es el de después.
  await esperarGuardado(page);

  await page.reload();
  await expect(page.getByText(TREE_COPY.emptyTitle)).toBeVisible();
});

test("mover un Nodo lo re-parenta, y el destino inválido se enseña bloqueado", async ({
  page,
}) => {
  await crearYAbrir(page, nombreUnico("mover"));

  await primerNodo(page, "Uno");
  await page.getByRole("button", { name: TREE_COPY.actions.sibling }).click();
  await escribirNodo(page, "Dos");

  // «Dos» sigue seleccionado. Se le busca padre.
  await page.getByRole("button", { name: TREE_COPY.actions.move }).click();
  // El diálogo se llama por el Nodo que se mueve, no por su acción.
  const dialogo = page.getByRole("dialog", {
    name: TREE_COPY.nodeLabel("Dos"),
  });

  // Los destinos bloqueados SE ENSEÑAN, no se filtran (ver `TREE_COPY`): el
  // propio Nodo está en la lista, con el motivo al lado.
  await expect(dialogo.getByText(TREE_COPY.moveBlockedSelf)).toBeVisible();

  // Las filas de destino se nombran por el texto pelado del Nodo, sin comillas:
  // es una lista de sitios, no una frase sobre uno.
  await dialogo.getByRole("button", { name: "Uno", exact: true }).click();
  await dialogo.getByRole("button", { name: TREE_COPY.moveSubmit }).click();

  await expect(dialogo).toBeHidden();
  await esperarGuardado(page);

  await page.reload();
  await expect(page.getByText(TREE_COPY.nodeCount(2))).toBeVisible();
  // Podar «Uno» ahora se lleva a «Dos» con él: es la prueba de que quedó
  // colgando de él y no al lado.
  await nodoPorTexto(page, "Uno").click();
  await page.getByRole("button", { name: TREE_COPY.actions.remove }).click();
  await expect(
    page.getByRole("dialog").getByText(TREE_COPY.deleteFalls(1)),
  ).toBeVisible();
});
