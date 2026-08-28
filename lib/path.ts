/**
 * Comparar rutas: la regla, en un solo sitio.
 *
 * La usan dos consumidores que tienen que estar de acuerdo o pasan cosas raras:
 * `lib/auth/routes.ts` decide con ella qué se ve sin sesión, y
 * `lib/shell/destinations.ts` qué destino del menú se enciende. Si cada uno
 * escribiera su propia comparación, un día `/projects/abc` estaría protegido
 * pero no marcaría «Proyectos», o al revés — y el fallo se vería en un sitio
 * mientras la causa vive en el otro.
 *
 * Puro y sin dependencias: lo consumen `proxy.ts` (runtime de Node, en cada
 * petición) y componentes de cliente.
 */

/** La barra final no cambia de página: `/about/` es `/about`. */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/**
 * ¿`pathname` ES `route`, o cuelga de ella?
 *
 * Compara por SEGMENTO y no por prefijo: `/about/lo-que-sea` sí, `/aboutus` no.
 * Sin esa distinción cualquier ruta que empiece igual que una conocida se
 * cuela — que en el guardia de auth significa dejarla pasar sin sesión.
 */
export function isSameOrUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}
