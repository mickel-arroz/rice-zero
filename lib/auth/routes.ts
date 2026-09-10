/**
 * Qué es público, qué está protegido y a dónde se vuelve después de entrar.
 *
 * Funciones puras y sin dependencias de Next, porque las consume `proxy.ts` —que
 * corre en el runtime de Node en cada petición— y también la página de login.
 * Ahí es donde tienen que estar los tests: la decisión «esta ruta necesita
 * sesión» es la que, si se equivoca, deja los Proyectos de alguien al aire.
 */

import { API_MOUNT } from "@/lib/backend/http/mount";
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
 * Las rutas del proveedor de auth que NO se reenvían.
 *
 * `app/api/auth/[...path]/route.ts` proxea cualquier segmento a Managed Better
 * Auth, y eso incluía `token`: el endpoint del plugin JWT que devuelve un JWT
 * de verdad, firmado y verificable por el motor.
 *
 * Mientras estuvo abierto, «el JWT no vive en el navegador» era falso. No hacía
 * falta alcanzar ninguna variable ni ningún closure: bastaba con
 *
 *     await (await fetch("/api/auth/token", { credentials: "include" })).json()
 *
 * para llevarse una credencial PORTÁTIL —usable desde otra máquina, sin la
 * pestaña de la víctima abierta, hasta su `exp`— contra toda la superficie del
 * Data API. Cerrarlo es lo que convierte un XSS de «se lleva una credencial» a
 * «actúa mientras la pestaña esté abierta, por las operaciones que existan».
 *
 * Se puede cerrar porque desde el ADR 0006 quien pide ese token es el servidor,
 * y lo hace en proceso (`adapters/neon/token.ts`) sin pasar por esta ruta. El
 * navegador dejó de necesitarlo el mismo día que dejó de hablar con el motor.
 *
 * Es lista NEGRA y no blanca, al revés que `PUBLIC_ROUTES`, y la asimetría es
 * deliberada: aquí el catálogo de rutas lo decide el proveedor y no nosotros,
 * así que una lista blanca se quedaría corta en cuanto el SDK añadiera un flujo
 * —y romperlo sería romper el login—. Equivocarse por este lado deja abierta
 * una ruta del proveedor; por el otro, tumba la autenticación entera.
 */
const BLOCKED_AUTH_PATHS: readonly string[] = ["token"];

/**
 * ¿Hay que negarse a reenviar esta ruta al proveedor de auth?
 *
 * @param path la ruta bajo el punto de montaje, sin barra inicial
 *   (`sign-in/email`, `token`, `token/anonymous`).
 */
export function isBlockedAuthPath(path: string): boolean {
  const normalized = normalizePath(`/${path.replace(/^\/+/, "")}`);
  return BLOCKED_AUTH_PATHS.some((blocked) =>
    isSameOrUnder(normalized, `/${blocked}`),
  );
}

/**
 * ¿Es esta una ruta de la API y no una página?
 *
 * Existe para que el guardia diga lo mismo en el protocolo que quien pregunta
 * entiende. Una página protegida sin sesión recibe un 302 a `/login`, que es lo
 * correcto para un navegador que navega. Un `fetch` que espera JSON lo SIGUE,
 * recibe el HTML del login con un 200, y revienta al parsearlo — el error que
 * llega a la pantalla no se parece en nada a «tu sesión caducó».
 *
 * Es el mismo fallo del que ya avisa el comentario del service worker en
 * `lib/constants.ts`, y la razón por la que el manifest y el worker están en la
 * lista de públicas. Aquí NO se resuelve así: una ruta de datos no es pública,
 * y meterla en `PUBLIC_ROUTES` tendría además un efecto que casi nadie
 * esperaría — esa lista viaja al proveedor como `skipRoutes`, así que una ruta
 * de ahí no refresca la cookie de sesión. En esta app se pueden pasar veinte
 * minutos en la misma pantalla emitiendo solo peticiones de datos; si ésas no
 * refrescaran, la sesión se moriría sola.
 *
 * Así que el guardia sigue corriendo sobre `/api/*` y lo único que cambia es
 * cómo se dibuja su decisión: 401 con JSON en vez de 302 con HTML.
 */
export function isApiPath(pathname: string): boolean {
  return isSameOrUnder(normalizePath(pathname), API_MOUNT);
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
