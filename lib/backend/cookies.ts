/**
 * Fusionar cookies recién sentadas con las que ya traía una petición.
 *
 * Hace falta en dos sitios y por la misma razón: cuando el guardia refresca la
 * sesión, las cookies nuevas van en la RESPUESTA, y quien tenga que leer la
 * sesión durante ESA misma petición seguiría viendo la vieja. Lo necesita
 * `proxy.ts` (para el Server Component que renderiza después) y lo necesita el
 * propio adaptador (para comprobar la sesión que acaba de mintear).
 *
 * Estándares web y nada de Next, igual que el puerto que lo usa.
 */

import type { SetCookies } from "@/lib/backend/ports";

/** `nombre=valor` del primer par de un `Set-Cookie`, o `null` si no lo tiene. */
function firstPair(setCookie: string): readonly [string, string] | null {
  const pair = setCookie.split(";")[0];
  const separator = pair.indexOf("=");
  if (separator < 1) return null;
  return [pair.slice(0, separator).trim(), pair.slice(separator + 1).trim()];
}

/** Las dos formas de decir «borra esta cookie»: valor vacío o `Max-Age=0`. */
function isDeletion(setCookie: string, value: string): boolean {
  if (value === "") return true;
  return setCookie
    .split(";")
    .slice(1)
    .some((attribute) => /^\s*max-age\s*=\s*0\s*$/i.test(attribute));
}

/**
 * Unas cabeceras nuevas con la cookie ya actualizada.
 *
 * No muta las que recibe. Un valor vacío o un `Max-Age=0` BORRAN la cookie,
 * porque son las dos formas de expresar un borrado en un `Set-Cookie` y de eso
 * depende `signOut`. El resto de atributos (`Path`, `SameSite`, `Expires`) se
 * ignoran: le hacen falta a un navegador para decidir a quién manda la cookie, y
 * aquí el destino es esta misma petición.
 */
export function mergeSetCookies(
  headers: Headers,
  setCookies: SetCookies,
): Headers {
  const merged = new Headers(headers);
  if (setCookies.length === 0) return merged;

  const jar = new Map<string, string>();
  const existing = headers.get("cookie");
  if (existing) {
    for (const chunk of existing.split(";")) {
      const pair = firstPair(chunk);
      if (pair) jar.set(pair[0], pair[1]);
    }
  }

  for (const setCookie of setCookies) {
    const pair = firstPair(setCookie);
    if (!pair) continue;
    const [name, value] = pair;
    if (isDeletion(setCookie, value)) jar.delete(name);
    else jar.set(name, value);
  }

  if (jar.size === 0) merged.delete("cookie");
  else
    merged.set(
      "cookie",
      [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    );
  return merged;
}
