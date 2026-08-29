/**
 * Con qué vista se abre el árbol de cada Proyecto: la última que se usó.
 *
 * Va en una cookie de primera parte y no en `localStorage` por lo mismo que
 * `sidebar.ts`: el servidor tiene que poder pintar la vista correcta en el
 * primer HTML. Con `localStorage` la pantalla saldría siempre en Registro y
 * saltaría al Canvas al hidratar — y aquí el salto no es de unos píxeles, es
 * una lista de filas cambiando por un lienzo.
 *
 * No es una cookie de sesión ni de seguridad: es una preferencia de interfaz.
 * De ahí que no sea `httpOnly` (la escribe el propio cliente al pulsar) ni
 * lleve `Secure` (no protege nada).
 *
 * ── Qué se guarda, y por qué así ──────────────────────────────────────────
 *
 * Solo los ids de los Proyectos que se dejaron en CANVAS, separados por comas
 * y con el más reciente delante. No un mapa `id → vista`: el Registro es lo
 * normal, así que anotarlo sería llenar la cookie de decir «esto está como
 * estaba». Un Proyecto que no sale en la lista se abre en Registro.
 *
 * Y hay tope. Una cookie viaja en CADA petición y no puede pasar de unos 4 KB;
 * sin tope, alguien con cien Proyectos mandaría casi tanto en cada petición
 * hasta que el navegador la tirase entera y se perdiera todo. Con el tope se
 * olvida el Proyecto que hace más que no se toca, que es el que menos duele.
 */

import { TREE_VIEWS, type TreeView } from "@/lib/constants";

export const TREE_VIEW_COOKIE = "rice0.tree-view";

/** Un año: la preferencia no caduca por dejar de entrar unas semanas. */
export const TREE_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cuántos Proyectos se recuerdan a la vez.
 *
 * Con ids de 36 caracteres son unos 900 bytes: holgado dentro del límite de la
 * cookie, y bastante más de los Proyectos que alguien abre en una temporada.
 */
export const REMEMBERED_PROJECTS = 24;

/**
 * La lista guardada, ya limpia.
 *
 * La cookie no es de confianza —la escribe el cliente y se puede editar a
 * mano—, así que todo lo que no tenga pinta de id se tira en vez de acabar
 * dentro de la próxima que se escriba.
 */
function parse(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9-]{1,64}$/.test(id));
}

/** Con qué vista se abre este Proyecto. */
export function treeViewFor(
  raw: string | undefined | null,
  projectId: string,
): TreeView {
  return parse(raw).includes(projectId)
    ? TREE_VIEWS.canvas
    : TREE_VIEWS.registro;
}

/**
 * La cadena que el cliente asigna a `document.cookie` tras cambiar de vista.
 *
 * Devolverla desde aquí —en vez de construirla en el componente— es lo que
 * permite comprobar en un test que lo que se escribe es exactamente lo que
 * `treeViewFor` sabe leer. Mismo criterio que `sidebarCookieAssignment`.
 */
export function treeViewCookieAssignment(
  raw: string | undefined | null,
  projectId: string,
  view: TreeView,
): string {
  const others = parse(raw).filter((id) => id !== projectId);
  const next =
    view === TREE_VIEWS.canvas ? [projectId, ...others] : others;

  const value = next.slice(0, REMEMBERED_PROJECTS).join(",");
  return `${TREE_VIEW_COOKIE}=${value}; path=/; max-age=${TREE_VIEW_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * El valor de una cookie dentro de `document.cookie`.
 *
 * Existe porque para escribir la siguiente lista hace falta la de ahora, y el
 * navegador solo da todas juntas en una cadena. Compara el nombre ENTERO: sin
 * eso, `rice0.tree-view-loquesea` pasaría por ésta y la vista se recordaría al
 * revés.
 */
export function cookieValue(all: string, name: string): string | undefined {
  for (const entry of all.split(";")) {
    const separator = entry.indexOf("=");
    if (separator === -1) continue;
    if (entry.slice(0, separator).trim() === name) {
      return entry.slice(separator + 1);
    }
  }
  return undefined;
}
