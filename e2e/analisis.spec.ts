/**
 * El Panel de IA: generar un Análisis, exportarlo y volver a leerlo.
 *
 * ── Contra qué modelo ────────────────────────────────────────────────────
 *
 * Contra ninguno. `playwright.config.ts` levanta el servidor con
 * `AI_PROVIDER=falso`, así que lo que contesta es `lib/ai/testing/fake.ts`:
 * determinista, sin red y sin cuota. Es lo que hace posible afirmar el TEXTO
 * exacto que sale, cosa que con un modelo de verdad no se puede hacer sin
 * escribir aserciones tan flojas que no prueben nada.
 *
 * Lo que eso NO prueba es Gemini, y está bien: para eso está `npm run ai:live`,
 * que corre la contract suite contra el proveedor de verdad.
 */

import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  crearYAbrir,
  escribirNodo,
  nombreUnico,
  primerNodo,
} from "@/e2e/apoyo/pantallas";
import { FAKE_MODEL } from "@/lib/ai/testing/fake";
import { ANALYSIS_COPY, TREE_COPY } from "@/lib/constants";

/**
 * Unas Directrices que fijan la Intención sin ambigüedad.
 *
 * «falla» es una de las señales que el proveedor falso busca para `fix`, y las
 * Directrices ganan sobre el árbol —es la regla del ADR 0003 y el falso la
 * respeta a propósito—. Así la prueba puede afirmar QUÉ Intención sale en vez
 * de conformarse con que salga alguna.
 */
const DIRECTRICES = "Esto ya está desplegado y falla al guardar: es un arreglo.";

/**
 * Cómo se llama el modelo que no existe.
 *
 * Importado de donde se decide y no copiado aquí: el día que cambie, una
 * segunda copia dejaría el cortafuegos de la cuota cerrando sobre un texto que
 * ya no aparece, y nadie se enteraría.
 */
const MODELO_FALSO = FAKE_MODEL;

/**
 * Las Intenciones se piden con `exact` en todo el archivo. «UI» son dos letras
 * y sin `exact` se encuentra dentro de «seguir editando», que es copia del
 * propio panel: la aserción fallaba por «strict mode violation» en vez de por
 * lo que decía mirar.
 */

/** Deja un árbol de dos Nodos listo para analizar. */
async function arbolAnalizable(page: Page): Promise<void> {
  await crearYAbrir(page, nombreUnico("analisis"));
  await primerNodo(page, "Pantalla de ajustes");
  await page.getByRole("button", { name: TREE_COPY.actions.child }).click();
  await escribirNodo(page, "Cambiar el idioma");
}

/** Abre el Panel de IA sobre el árbol que ya está en pantalla. */
function abrirPanel(page: Page): Locator {
  return page.getByLabel(ANALYSIS_COPY.label, { exact: true });
}

/**
 * Escribe las Directrices y genera.
 *
 * Un ayudante y no tres copias porque la secuencia —abrir, escribir, pulsar— se
 * repetía entera en los tres casos del archivo, y lo que cada uno quiere decir
 * está DESPUÉS de ella.
 *
 * `boton` es «Generar» la primera vez y «Regenerar» a partir de la segunda: lo
 * decide el propio panel según haya Análisis o no, así que quien llama tiene
 * que saberlo.
 */
async function generar(
  panel: Locator,
  boton: string,
  directrices?: string,
): Promise<void> {
  if (directrices !== undefined) {
    await panel.getByLabel(ANALYSIS_COPY.guidelinesField).fill(directrices);
  }
  await panel.getByRole("button", { name: boton, exact: true }).click();
}

test("generar un Análisis, leerlo y exportar el Master Prompt", async ({ page }) => {
  await arbolAnalizable(page);

  await page.getByRole("button", { name: ANALYSIS_COPY.openPanel }).click();
  const panel = abrirPanel(page);
  await expect(panel).toBeVisible();

  // Antes de generar, el panel dice cuántos Nodos va a leer.
  await expect(panel.getByText(ANALYSIS_COPY.emptyMeta(2))).toBeVisible();

  await generar(panel, ANALYSIS_COPY.generate, DIRECTRICES);

  // ── Lo que devolvió ─────────────────────────────────────────────────────
  //
  // La Intención sale de las Directrices, no del árbol: es la única palanca
  // que el usuario tiene para corregirla (ADR 0003), y ésta es la prueba de
  // que de verdad manda.
  await expect(panel.getByText(ANALYSIS_COPY.intents.fix, { exact: true })).toBeVisible();
  await expect(panel.getByText(ANALYSIS_COPY.summary)).toBeVisible();

  // ── El cortafuegos de la cuota ──────────────────────────────────────────
  //
  // El panel dice SIEMPRE con qué modelo se escribió un Análisis (`provenance`,
  // que existe porque el adaptador tiene cadena de reserva). Aquí eso sirve de
  // segunda cosa: si alguien apunta la suite a un servidor que no lleva
  // `AI_PROVIDER=falso` —`E2E_BASE_URL` se salta el entorno que fija
  // `playwright.config.ts`—, esta línea lo caza en la PRIMERA generación en vez
  // de dejar que la suite entera se coma el free tier del día en silencio.
  await expect(
    panel.getByText(new RegExp(MODELO_FALSO)),
    `El servidor no está usando el Proveedor de IA falso. Si lo levantaste a mano, arráncalo con AI_PROVIDER=falso.`,
  ).toBeVisible();

  // Un Ticket por raíz, con el subnodo dentro como Check: todo Nodo del árbol
  // queda representado, que es lo que `CONTEXT.md` exige de un Análisis.
  await expect(panel.getByRole("heading", { name: "Pantalla de ajustes" })).toBeVisible();
  await expect(panel.getByText("Cambiar el idioma")).toBeVisible();

  // ── Exportar ────────────────────────────────────────────────────────────
  await panel.getByRole("button", { name: ANALYSIS_COPY.copyMaster }).click();
  await expect(panel.getByText(ANALYSIS_COPY.copied)).toBeVisible();

  const portapapeles = await page.evaluate(() => navigator.clipboard.readText());
  expect(portapapeles).toContain("Pantalla de ajustes");
  // Markdown mínimo funcional: un Check se escribe `- [ ]` y nada más.
  expect(portapapeles).toContain("- [ ] Cambiar el idioma");
  // Sin negritas, cursivas, tablas ni code fences: es lo que `CONTEXT.md` pide
  // del Master Prompt, «Markdown mínimo funcional y nada más».
  expect(portapapeles).not.toMatch(/\*\*|```|\|/);

  const descarga = page.waitForEvent("download");
  await panel.getByRole("button", { name: ANALYSIS_COPY.downloadMaster }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^rice0-master-\d{4}-\d{2}-\d{2}-\d{4}\.md$/);
});

test("el Ticket Prompt se exporta suelto, con su propio contexto", async ({ page }) => {
  await arbolAnalizable(page);

  await page.getByRole("button", { name: ANALYSIS_COPY.openPanel }).click();
  const panel = abrirPanel(page);
  await generar(panel, ANALYSIS_COPY.generate, DIRECTRICES);

  await expect(panel.getByText(ANALYSIS_COPY.intents.fix, { exact: true })).toBeVisible();

  await panel.getByRole("button", { name: ANALYSIS_COPY.copyTicket("t1") }).click();
  const texto = await page.evaluate(() => navigator.clipboard.readText());

  // Lo que sale NO es lo que se ve en la tarjeta: el renderer le añade la
  // Intención y el Spec para que el Ticket valga pegado solo en un agente.
  expect(texto).toContain("Pantalla de ajustes");
  expect(texto).toContain("- [ ] Cambiar el idioma");

  const descarga = page.waitForEvent("download");
  await panel.getByRole("button", { name: ANALYSIS_COPY.downloadTicket("t1") }).click();
  expect((await descarga).suggestedFilename()).toMatch(/^rice0-t1-/);
});

test("el Historial guarda los dos, y el vigente es el nuevo", async ({ page }) => {
  await arbolAnalizable(page);

  await page.getByRole("button", { name: ANALYSIS_COPY.openPanel }).click();
  const panel = abrirPanel(page);

  // Primero: sin Directrices. El falso deduce del ÁRBOL, y ahí la palabra
  // «Pantalla» es una de las señales de `ui` (ver `SIGNALS` en `fake.ts`).
  await generar(panel, ANALYSIS_COPY.generate);
  await expect(panel.getByText(ANALYSIS_COPY.intents.ui, { exact: true })).toBeVisible();

  // Segundo: con Directrices. Regenerar crea uno nuevo; el anterior se queda.
  await panel.getByText(ANALYSIS_COPY.guidelinesField).click();
  await generar(panel, ANALYSIS_COPY.regenerate, DIRECTRICES);
  await expect(panel.getByText(ANALYSIS_COPY.intents.fix, { exact: true })).toBeVisible();

  // ── La lista ────────────────────────────────────────────────────────────
  await panel.getByRole("button", { name: ANALYSIS_COPY.historyOpen(2) }).click();
  await expect(panel.getByText(ANALYSIS_COPY.historyMeta(2))).toBeVisible();
  // El primero de la lista es el vigente, y lleva su insignia.
  await expect(panel.getByText(ANALYSIS_COPY.historyCurrent)).toBeVisible();
  // Y se recuerda con qué Directrices se pidió: es lo que explica la
  // diferencia entre los dos.
  await expect(
    panel.getByText(ANALYSIS_COPY.historyGuidelines(DIRECTRICES)),
  ).toBeVisible();

  // ── Un Análisis viejo se abre, y se dice que es viejo ───────────────────
  await panel.getByText(ANALYSIS_COPY.intents.ui, { exact: true }).click();
  await expect(panel.getByRole("button", { name: ANALYSIS_COPY.pastGoToCurrent })).toBeVisible();

  // Y sobrevive a una recarga: el Historial vive en el motor, no en memoria.
  await page.reload();
  await page.getByRole("button", { name: ANALYSIS_COPY.openPanel }).click();
  await expect(
    page.getByRole("button", { name: ANALYSIS_COPY.historyOpen(2) }),
  ).toBeVisible();
});
