/**
 * Proyectos: crear, ver lo que trae dentro, y borrar.
 *
 * La afirmación que importa es la de la Versión inicial: el spec dice que un
 * Proyecto nace SIEMPRE con una, y eso lo garantiza el motor (ver
 * `db/migrations/0001_initial_schema.sql`), no la app. Una prueba de unidad
 * contra el adaptador en memoria lo comprueba contra una imitación; ésta lo
 * comprueba contra Neon, que es donde de verdad tiene que ser cierto.
 */

import { expect, test } from "@playwright/test";

import { crearProyecto, nombreUnico } from "@/e2e/apoyo/pantallas";
import { PROJECTS_COPY, ROUTES } from "@/lib/constants";

test("un Proyecto nuevo nace con su Versión inicial y sin Nodos", async ({ page }) => {
  const titulo = nombreUnico("nace");
  await crearProyecto(page, titulo);

  const tarjeta = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: titulo, level: 2 }) });

  // Las cifras de la tarjeta salen de la vista `project_overviews`, así que
  // esto afirma de paso que la vista cuenta lo que dice contar. Se piden con su
  // número delante porque así se pintan: «1 Versión», no dos textos sueltos.
  await expect(tarjeta.getByText(`1 ${PROJECTS_COPY.versions(1)}`)).toBeVisible();
  await expect(tarjeta.getByText(`0 ${PROJECTS_COPY.nodes(0)}`)).toBeVisible();

  // «Análisis» se esconde en cero a propósito (ver `project-card.tsx`).
  await expect(tarjeta.getByText(PROJECTS_COPY.analyses)).toBeHidden();
});

test("borrar un Proyecto lo quita de la lista y de los accesos directos", async ({
  page,
}) => {
  const titulo = nombreUnico("efimero");
  await crearProyecto(page, titulo);

  await page.getByRole("button", { name: PROJECTS_COPY.actions(titulo) }).click();
  await page.getByRole("menuitem", { name: PROJECTS_COPY.delete }).click();

  const dialogo = page.getByRole("dialog", { name: PROJECTS_COPY.deleteTitle(titulo) });
  await dialogo.getByRole("button", { name: PROJECTS_COPY.delete, exact: true }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("heading", { name: titulo, level: 2 })).toBeHidden();
  // Y del acceso directo, que sale del MISMO provider: si esto siguiera ahí,
  // pulsarlo llevaría a un Proyecto que ya no existe.
  await expect(page.getByRole("link", { name: titulo, exact: true })).toBeHidden();
});

test("editar el título se guarda solo, sin botón de guardar", async ({ page }) => {
  const titulo = nombreUnico("renombrable");
  await crearProyecto(page, titulo);

  await page.getByRole("button", { name: PROJECTS_COPY.actions(titulo) }).click();
  await page.getByRole("menuitem", { name: PROJECTS_COPY.edit }).click();

  const dialogo = page.getByRole("dialog", { name: PROJECTS_COPY.editTitle });
  const nuevo = `${titulo} v2`;
  await dialogo.getByLabel(PROJECTS_COPY.titleField).fill(nuevo);

  // El acuse es el pie del diálogo, que es lo único que hay: no hay «Guardar».
  await expect(dialogo.getByText(PROJECTS_COPY.saved)).toBeVisible();
  await dialogo.getByRole("button", { name: PROJECTS_COPY.close }).click();

  await expect(page.getByRole("heading", { name: nuevo, level: 2 })).toBeVisible();

  // Y sobrevive a una recarga: el acuse de arriba podría ser solo estado local.
  await page.goto(ROUTES.projects);
  await expect(page.getByRole("heading", { name: nuevo, level: 2 })).toBeVisible();
});
