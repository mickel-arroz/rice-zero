/**
 * Dónde se monta la superficie HTTP de datos, y cómo se arma cada ruta.
 *
 * Vive en un módulo propio y minúsculo porque lo leen tres sitios que TIENEN
 * que coincidir, y ninguno puede importar de los otros dos:
 *
 *   · el adaptador de navegador, que construye las URLs;
 *   · `proxy.ts`, que decide contestar 401 en JSON en vez de 302 a HTML;
 *   · `lib/pwa/cache.ts`, que las deja fuera del service worker.
 *
 * Las carpetas de `app/api/` son la cuarta copia y ésa no se puede evitar: en
 * Next el nombre del archivo ES la ruta. Lo que sí evita este módulo es que
 * haya una quinta escrita a mano en cada `fetch`.
 */

/** La raíz de TODA la superficie HTTP de la app, datos y auth incluidos. */
export const API_MOUNT = "/api";

/**
 * Los cuatro puntos de montaje, uno por repositorio del puerto.
 *
 * En plural y en la lengua del código, no del dominio: son URLs, y una URL con
 * eñes y acentos se escapa en la barra de direcciones y en los logs. El
 * vocabulario de `CONTEXT.md` manda en la interfaz; aquí manda el cable.
 */
export const DATA_ROUTES = {
  projects: `${API_MOUNT}/projects`,
  versions: `${API_MOUNT}/versions`,
  nodes: `${API_MOUNT}/nodes`,
  analyses: `${API_MOUNT}/analyses`,
} as const;

/**
 * Une la ruta con su query, omitiendo lo que no se manda.
 *
 * `URLSearchParams` y no una plantilla: un término de búsqueda puede llevar
 * `&`, `#` o un `+` que significa un espacio, y concatenar a mano convierte
 * buscar «C++ & Rust» en dos parámetros rotos.
 */
export function withQuery(
  path: string,
  query: Readonly<Record<string, string | number | undefined>>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}
