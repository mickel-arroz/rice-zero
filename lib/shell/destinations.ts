/**
 * Los destinos del shell del dashboard.
 *
 * Una sola lista para los dos formatos: la sidebar de escritorio y el menú
 * móvil la recorren igual, así que «los mismos destinos en ambos» deja de ser
 * una regla que alguien tiene que recordar y pasa a ser lo único posible.
 *
 * Módulo puro y sin dependencias de Next —igual que `lib/auth/routes.ts`—
 * porque lo consumen componentes de cliente y de servidor a la vez.
 */

import { PROJECTS_COPY, ROUTES, SHELL_COPY } from "@/lib/constants";
import { isSameOrUnder, normalizePath } from "@/lib/path";

export const DESTINATIONS = [
  { id: "projects", href: ROUTES.projects, label: PROJECTS_COPY.title },
  { id: "about", href: ROUTES.about, label: SHELL_COPY.about },
] as const;

export type Destination = (typeof DESTINATIONS)[number];
export type DestinationId = Destination["id"];

/**
 * El destino que hay que marcar como activo para una ruta, o `null` si la ruta
 * no cae bajo ninguno.
 *
 * @param pathname la ruta actual, tal cual la da `usePathname()`.
 */
export function activeDestination(pathname: string): DestinationId | null {
  const path = normalizePath(pathname);
  // `find` y no un `switch`: recorrer la misma lista que se pinta es lo que
  // garantiza que un destino nuevo se marque solo, sin que nadie recuerde
  // venir a tocar esto también.
  return DESTINATIONS.find((d) => isSameOrUnder(path, d.href))?.id ?? null;
}
