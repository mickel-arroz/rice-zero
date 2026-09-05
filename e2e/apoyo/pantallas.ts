/**
 * Los gestos que se repiten en varias pruebas, escritos una vez.
 *
 * No es un «page object» con una clase por pantalla: son funciones sueltas, y
 * solo están aquí las que aparecen en TRES archivos o más. Una capa de
 * abstracción por pantalla en una suite de siete archivos esconde justo lo que
 * una prueba E2E tiene que dejar leer — qué se pulsa y en qué orden.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { literal } from "@/e2e/apoyo/texto";
import { NODE_TEXT_DEBOUNCE_MS } from "@/components/tree/autosave";
import { AUTH_COPY, PROJECTS_COPY, ROUTES, SHELL_COPY, TREE_COPY } from "@/lib/constants";

/**
 * ── La carrera de la hidratación ─────────────────────────────────────────
 *
 * El HTML llega del servidor con todo pintado, pero hasta que React no engancha
 * sus manejadores, un clic no hace nada y un `fill` deja el texto en el DOM sin
 * que el estado de React se entere — y entonces un formulario con los dos
 * campos escritos sigue creyendo que están vacíos y no deja enviar. Pasa de
 * verdad: es lo primero que se rompió al correr esta suite contra un build de
 * producción con el servidor recién arrancado.
 *
 * No hay una señal fiable de «ya hidrató» que se pueda mirar desde fuera —
 * `next-themes` pinta la clase del tema con un script BLOQUEANTE, así que ni
 * eso sirve—. Lo que sí se puede hacer es lo que Playwright propone para esto:
 * repetir la interacción hasta que la app CONTESTE. Los dos ayudantes de abajo
 * son eso, y solo hacen falta justo después de un `goto`: dentro de la app ya
 * hidratada, un `fill` normal basta.
 */

/**
 * Pulsa hasta que aparezca lo que tenía que aparecer.
 *
 * @param boton lo que se pulsa.
 * @param resultado lo que prueba que el clic llegó a React.
 */
export async function pulsarHidratado(
  boton: Locator,
  resultado: Locator,
): Promise<void> {
  await expect(async () => {
    await boton.click();
    await expect(resultado).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Rellena el formulario de entrar y envía.
 *
 * Se vacía cada campo ANTES de escribirlo, y no es ceremonia: `fill` con el
 * MISMO valor dispara su evento igual, pero React se encuentra el estado que ya
 * tenía y no repinta. Sin el vaciado, el reintento escribiría el texto que ya
 * está puesto y el botón seguiría apagado para siempre.
 */
export async function entrarConEmail(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  const correo = page.getByLabel(AUTH_COPY.emailLabel);
  const clave = page.getByLabel(AUTH_COPY.signIn.passwordLabel, { exact: true });
  const enviar = page.getByRole("button", {
    name: AUTH_COPY.signIn.submit,
    exact: true,
  });

  await expect(async () => {
    await correo.fill("");
    await correo.fill(email);
    await clave.fill("");
    await clave.fill(password);
    // El CTA se apaga con `aria-disabled` mientras algún campo esté vacío PARA
    // REACT, así que encenderse es la prueba de que el estado llegó.
    await expect(enviar).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  await enviar.click();
}

/**
 * El prefijo de todo lo que crea la suite.
 *
 * Sirve para reconocer de un vistazo lo que dejó una corrida que se murió a la
 * mitad, en la base o en una captura de pantalla. La semilla vacía la cuenta
 * entera igualmente (`e2e/apoyo/semilla.ts`), así que esto es legibilidad, no
 * un filtro del que dependa nada.
 */
const PREFIJO = "E2E";

/**
 * Un nombre que no choca con el de otra prueba.
 *
 * Hace falta porque las pruebas corren en paralelo contra la MISMA cuenta: dos
 * Proyectos llamados igual dejarían a `getByRole("link", { name })` eligiendo
 * entre dos, y el fallo saldría como «strict mode violation» en una prueba que
 * no tiene nada que ver con la que causó el choque.
 *
 * ⚠ Lo que sale de aquí acaba en la sidebar Y en el `h1` de la pantalla del
 * Proyecto, así que está en el DOM de casi todas las pruebas. Un `getByText`
 * sin `exact` sobre una palabra corta de la interfaz —«Pendiente», «v2»— se lo
 * encuentra y falla por «strict mode violation» en una aserción que no tenía
 * nada que ver. Por eso las aserciones sobre copia corta van con `exact` o
 * acotadas a su contenedor.
 */
export function nombreUnico(que: string): string {
  const sufijo = Math.random().toString(36).slice(2, 8);
  return `${PREFIJO} ${que} ${sufijo}`;
}

/** La URL de un árbol: `/projects/<proyecto>/<versión>`. */
export const URL_DE_ARBOL = /\/projects\/[0-9a-fA-F-]{36}\/[0-9a-fA-F-]{36}/;

/**
 * Crea un Proyecto desde la pantalla de Proyectos y se queda allí.
 *
 * @returns el título, para encadenarlo sin repetirlo.
 */
export async function crearProyecto(page: Page, titulo: string): Promise<string> {
  await page.goto(ROUTES.projects);

  const dialogo = page.getByRole("dialog", { name: PROJECTS_COPY.newProject });
  // El botón de la cabecera solo existe cuando YA hay Proyectos; con la lista
  // vacía la llamada vive dentro del recuadro. Los dos dicen lo mismo, así que
  // se pide por nombre y se toma el que esté puesto. Va por `pulsarHidratado`
  // porque es el PRIMER clic tras un `goto`.
  await pulsarHidratado(
    page.getByRole("button", { name: PROJECTS_COPY.newProject }).first(),
    dialogo,
  );

  await dialogo.getByLabel(PROJECTS_COPY.titleField).fill(titulo);
  await dialogo.getByRole("button", { name: PROJECTS_COPY.createSubmit }).click();

  await expect(dialogo).toBeHidden();
  await expect(page.getByRole("heading", { name: titulo, level: 2 })).toBeVisible();
  return titulo;
}

/**
 * Abre el árbol de un Proyecto por su acceso directo.
 *
 * Es el único camino que hay: la tarjeta de la lista NO es un enlace (ver
 * `project-card.tsx`), así que se entra por la sidebar en escritorio y por el
 * menú de la cabecera en el teléfono. Esta función se traga esa diferencia
 * porque la tienen las siete pruebas y no es lo que ninguna quiere afirmar.
 */
export async function abrirProyecto(page: Page, titulo: string): Promise<void> {
  const enlace = await conNavegacionAbierta(
    page,
    page.getByRole("link", { name: titulo, exact: true }),
  );
  await enlace.click();

  // `/projects/<id>` redirige a la Versión activa, así que se espera a la URL
  // con las DOS partes: sin esto la prueba seguiría sobre la pantalla puente.
  await page.waitForURL(URL_DE_ARBOL);
}

/**
 * Devuelve ese control ya alcanzable, abriendo el menú del teléfono si hace
 * falta.
 *
 * El shell monta las DOS navegaciones a la vez —la sidebar de escritorio y el
 * menú de la cabecera—, así que en móvil el mismo control existe dos veces y
 * una de las dos copias está escondida y no se va a poder pulsar nunca. De ahí
 * el `visible: true`, que es lo que distingue «no está» de «está, pero detrás
 * del menú».
 */
export async function conNavegacionAbierta(
  page: Page,
  control: Locator,
): Promise<Locator> {
  const alcanzable = control.filter({ visible: true });
  if ((await alcanzable.count()) === 0) {
    await page.getByRole("button", { name: SHELL_COPY.openMenu }).click();
  }
  return alcanzable.first();
}

/** Lo de arriba, seguido: crear y entrar. */
export async function crearYAbrir(page: Page, titulo: string): Promise<string> {
  await crearProyecto(page, titulo);
  await abrirProyecto(page, titulo);
  return titulo;
}

/**
 * La fila de un Nodo, esté seleccionado o no.
 *
 * Se pide por una expresión regular sobre el texto ENTRECOMILLADO y no por el
 * nombre completo porque la fila tiene dos nombres según su estado: uno lo
 * llama a seleccionar (`TREE_COPY.select`) y el otro a editar
 * (`TREE_COPY.edit`), y quien llama a esto casi nunca sabe en cuál de los dos
 * está. Las comillas son lo que evita que «Uno» encuentre también a «Uno más».
 */
export function nodoPorTexto(page: Page, texto: string) {
  return page.getByRole("button", {
    name: new RegExp(literal(TREE_COPY.nodeLabel(texto))),
  });
}

/**
 * Escribe en el Nodo que esté en edición, lo guarda y CIERRA el campo.
 *
 * Las tres cosas, y la tercera es la que evita una clase entera de fallos: un
 * Nodo abierto es un `textarea`, no un botón, así que mientras el campo siga
 * abierto `nodoPorTexto` no encuentra nada. Escape cierra el campo sin
 * deseleccionar —lo dice `node-row.tsx`—, de modo que la barra de acciones
 * sigue delante y colgar un subnodo detrás de esto sigue siendo un botón.
 *
 * El Autoguardado espera 500 ms desde la última tecla
 * (`NODE_TEXT_DEBOUNCE_MS`), así que sin esperar a «Guardado» la prueba
 * siguiente correría contra un árbol que todavía no está en el backend.
 */
export async function escribirNodo(page: Page, texto: string): Promise<void> {
  const campo = campoAbierto(page);
  await campo.fill(texto);
  await esperarGuardado(page);
  // Por el TECLADO y no por el campo: al escribir, su nombre accesible pasa de
  // «este Nodo» a «"lo que se escribió"», así que el localizador de arriba ya
  // no encuentra nada. El foco sigue dentro, que es lo que Escape necesita.
  await page.keyboard.press("Escape");
}

/**
 * El campo abierto del árbol, sea cual sea el Nodo.
 *
 * Se pide por su SITIO —el `textarea` de una fila de la lista— y no por su
 * nombre accesible, y no es pereza: ese nombre lleva dentro el texto del Nodo
 * (`TREE_COPY.edit`), así que cambia con cada tecla. Un localizador por nombre
 * deja de encontrar el campo en cuanto se escribe en él, que es exactamente
 * cuando hace falta mirarlo.
 *
 * Solo hay uno abierto a la vez: `editingId` es uno o ninguno.
 */
export function campoAbierto(page: Page) {
  return page.locator("li textarea");
}

/**
 * Espera a que lo tecleado esté DE VERDAD guardado.
 *
 * ── Por qué hay una espera fija, que normalmente sería un olor ────────────
 *
 * Porque el pie del Autoguardado miente durante medio segundo, y no por un
 * fallo suyo: el rebote (`NODE_TEXT_DEBOUNCE_MS`) hace que entre la última
 * tecla y la primera señal de «Guardando…» no pase NADA en pantalla. En esa
 * ventana el pie sigue diciendo «Guardado» — del guardado ANTERIOR—, así que
 * una espera que solo mirase el pie volvería inmediatamente y la prueba
 * siguiente correría contra un árbol que todavía no está en el backend.
 *
 * La espera es exactamente el rebote, importado de donde se decide y no
 * escrito a mano aquí: dos definiciones del mismo medio segundo se
 * desincronizarían el día que alguien lo ajuste. Pasado el rebote, la escritura
 * ya salió, y a partir de ahí sí manda el pie.
 *
 * `exact` en las dos: los títulos que inventa `nombreUnico` viajan en la
 * sidebar y en el `h1` de la pantalla, y un `getByText` laxo sobre una palabra
 * corta acaba encontrándolos a ellos. Pasó con «Pendiente».
 */
export async function esperarGuardado(page: Page): Promise<void> {
  await page.waitForTimeout(NODE_TEXT_DEBOUNCE_MS);
  await expect(page.getByText(TREE_COPY.saving, { exact: true })).toBeHidden();
  await expect(page.getByText(TREE_COPY.saved, { exact: true }).first()).toBeVisible();
}

/**
 * Crea el primer Nodo del árbol con ese texto y lo deja guardado.
 *
 * El recuadro vacío tiene su propia llamada («Primer Nodo»); a partir del
 * segundo, la de la lista es «Nodo raíz». Aquí solo hace falta la primera.
 */
export async function primerNodo(page: Page, texto: string): Promise<void> {
  const campo = campoAbierto(page);

  // Con reintento, y por un motivo que no es la hidratación: `createRoot` se
  // lanza con `fire()`, que se traga el rechazo a propósito —el fallo ya lo
  // enseña la cabecera— así que un clic que la app decidió no atender no se
  // distingue de uno que no llegó. Se mira si el campo YA está antes de volver
  // a pulsar, para no acabar con dos raíces.
  await expect(async () => {
    if ((await campo.count()) === 0) {
      await page.getByRole("button", { name: TREE_COPY.firstNode }).click();
    }
    await expect(campo).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });

  await escribirNodo(page, texto);
}
