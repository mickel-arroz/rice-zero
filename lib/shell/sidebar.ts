/**
 * El estado de la sidebar: colapsada o expandida.
 *
 * Va en una cookie de primera parte y no en `localStorage` porque el servidor
 * tiene que poder pintar el ancho correcto en el primer HTML. Con
 * `localStorage` la sidebar saldría siempre expandida y se encogería al
 * hidratar — un salto visible en cada navegación para quien la dejó colapsada.
 *
 * No es una cookie de sesión ni de seguridad: es una preferencia de interfaz.
 * De ahí que no sea `httpOnly` (la escribe el propio cliente al pulsar) ni
 * lleve `Secure` (no protege nada). El único requisito real es que el servidor
 * la vea, y para eso basta con que exista.
 */

export const SIDEBAR_COOKIE = "rice0.sidebar";

/** Un año: la preferencia no caduca por dejar de entrar unas semanas. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const COLLAPSED = "collapsed";
const EXPANDED = "expanded";

/**
 * ¿Está colapsada?
 *
 * Solo el valor exacto `collapsed` colapsa. Cualquier otra cosa —ausente,
 * vacía, con otras mayúsculas o escrita a mano desde la consola— cuenta como
 * expandida: la cookie no es de confianza, y un valor que no reconocemos no
 * puede dejar la interfaz en un tercer estado que nadie diseñó.
 */
export function isSidebarCollapsed(raw: string | undefined | null): boolean {
  return raw === COLLAPSED;
}

/**
 * La cadena que el cliente asigna a `document.cookie`.
 *
 * Devolverla desde aquí —en vez de construirla en el componente— es lo que
 * permite comprobar en un test que lo que se escribe es exactamente lo que
 * `isSidebarCollapsed` sabe leer.
 */
export function sidebarCookieAssignment(collapsed: boolean): string {
  const value = collapsed ? COLLAPSED : EXPANDED;
  return `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`;
}
