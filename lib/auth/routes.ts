/**
 * Qué es público, qué está protegido y a dónde se vuelve después de entrar.
 *
 * Funciones puras y sin dependencias de Next, porque las consume `proxy.ts` —que
 * corre en el runtime de Node en cada petición— y también la página de login.
 * Ahí es donde tienen que estar los tests: la decisión «esta ruta necesita
 * sesión» es la que, si se equivoca, deja los Proyectos de alguien al aire.
 */

import { NEXT_PARAM, PUBLIC_ROUTES, ROUTES } from "@/lib/constants";
// La comparación de rutas vive en `lib/path.ts` desde el #8: el shell la
// necesita para marcar el destino activo, y las dos tienen que coincidir.
import { isSameOrUnder, normalizePath } from "@/lib/path";

/**
 * ¿Se puede ver esta ruta sin sesión?
 *
 * La raíz se compara exacta y no por prefijo: con `startsWith("/")` toda la app
 * sería pública.
 */
export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return PUBLIC_ROUTES.some((route) =>
    route === ROUTES.home ? path === route : isSameOrUnder(path, route),
  );
}

/**
 * El destino al que volver tras entrar, o `null` si no hay ninguno que merezca
 * la pena.
 *
 * Filtra el destino en vez de confiar en él: un `next` sin comprobar convierte
 * el login en un redirector abierto, y basta un enlace a
 * `/login?next=https://phishing.example` para que la app mande al usuario fuera
 * justo después de autenticarse, con la credibilidad de venir de aquí.
 *
 * Solo pasa una ruta absoluta de ESTE sitio, y solo si está protegida: volver al
 * propio login es un bucle, y volver a la landing pierde el sitio al que iba.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Una sola barra al principio y nunca dos: `//host` y `/\host` son destinos
  // externos que el navegador resuelve como protocolo relativo.
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;

  // `new URL` con una base ficticia normaliza `..`, `%2f` y compañía, así que la
  // comprobación se hace sobre lo que el navegador entendería, no sobre el texto.
  let parsed: URL;
  try {
    parsed = new URL(raw, "https://rice.invalid");
  } catch {
    return null;
  }
  if (parsed.origin !== "https://rice.invalid") return null;
  if (isPublicPath(parsed.pathname)) return null;

  return `${parsed.pathname}${parsed.search}`;
}

/**
 * A dónde mandar a quien pide una ruta protegida sin sesión.
 *
 * @param pathname la ruta que se pedía.
 * @param requestUrl la URL completa de la petición, que aporta el origen.
 */
export function loginRedirectFor(pathname: string, requestUrl: string): URL {
  const url = new URL(ROUTES.login, requestUrl);
  const next = safeNextPath(pathname);
  if (next) url.searchParams.set(NEXT_PARAM, next);
  return url;
}
