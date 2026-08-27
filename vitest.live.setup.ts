/**
 * Preparativos de las corridas en vivo: aquí se simula al navegador.
 *
 * El adaptador está pensado para el navegador —el ADR decide que el cliente
 * habla directo con PostgREST— y el SDK del proveedor da dos cosas por
 * supuestas que en Node no existen:
 *
 *   1. La cabecera `Origin`. Managed Better Auth responde
 *      `403 feature_not_supported — "Missing or null Origin"` sin ella, y la
 *      pone el navegador, no la aplicación.
 *   2. Un tarro de cookies. Better Auth entrega la sesión en un `Set-Cookie` y
 *      espera recibirla de vuelta; el `fetch` de Node no guarda nada, así que el
 *      login «funcionaba» y acto seguido el Data API contestaba
 *      `AuthRequiredError: a valid token is needed`.
 *
 * Las dos se parchean AQUÍ y no en `lib/backend/`: en producción el navegador
 * las aporta solas, así que ponerlas en el adaptador sería código muerto
 * escrito para engañar a un test. El harness es el sitio honesto para fingir un
 * navegador.
 *
 * El `Origin` por defecto es el mismo que el wizard registra como Site URL de
 * desarrollo, así que pasa la comprobación del proveedor.
 */

const ORIGIN = process.env.BACKEND_CONTRACT_ORIGIN?.trim() || "http://localhost:3000";

const nodeFetch = globalThis.fetch;

/** `nombre -> valor`. Un tarro por proceso, como una pestaña. */
const jar = new Map<string, string>();

/** `nombre=valor; nombre=valor`, o nada si el tarro está vacío. */
function cookieHeader(): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/**
 * Guarda lo que la respuesta pida guardar.
 *
 * Solo se mira el primer par `nombre=valor` de cada `Set-Cookie`: los
 * atributos (`Path`, `SameSite`, `HttpOnly`, `Secure`) los necesita un
 * navegador para decidir a quién manda la cookie, y aquí el destino siempre es
 * el mismo proveedor. Lo que sí se respeta es el borrado, porque `signOut`
 * depende de él.
 */
function storeCookies(response: Response): void {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attributes] = raw.split(";");
    const separator = pair.indexOf("=");
    if (separator < 1) continue;

    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    const deleted =
      value === "" ||
      attributes.some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));

    if (deleted) jar.delete(name);
    else jar.set(name, value);
  }
}

globalThis.fetch = async function browserishFetch(input, init) {
  const headers = new Headers(init?.headers ?? undefined);

  // Un `Request` puede traer las suyas, y no se pierden.
  if (input instanceof Request) {
    for (const [key, value] of input.headers) {
      if (!headers.has(key)) headers.set(key, value);
    }
  }

  if (!headers.has("origin")) headers.set("origin", ORIGIN);
  // Algunos servicios miran `Referer` además de `Origin`.
  if (!headers.has("referer")) headers.set("referer", `${ORIGIN}/`);

  const cookies = cookieHeader();
  if (cookies && !headers.has("cookie")) headers.set("cookie", cookies);

  const response = await nodeFetch(input, { ...init, headers });
  storeCookies(response);
  return response;
} as typeof fetch;
