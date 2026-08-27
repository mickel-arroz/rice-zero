/**
 * La capa de acceso a la sesión en servidor.
 *
 * Es el patrón que la documentación de Next llama Data Access Layer: un solo
 * sitio desde el que un Server Component pregunta quién está entrando, en un
 * archivo `server-only` para que no pueda colarse en un Client Component.
 *
 * Los mismos docs son explícitos sobre por qué NO se comprueba en un layout: los
 * layouts no se vuelven a renderizar al navegar, así que la sesión no se
 * revisaría en cada cambio de ruta, y además un layout no decide si el resto de
 * la ruta se renderiza. Y `proxy.ts` tampoco basta por sí solo. Aquí, en cambio,
 * cada página que necesita la sesión la pide.
 *
 * `cache` de React lo memoiza por petición: dos componentes que la pidan en el
 * mismo render comparten una sola lectura.
 */

import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { getServerBackend } from "@/lib/backend/server";
import type { AuthSession } from "@/lib/backend/ports";

/**
 * La sesión de esta petición, o `null`. No lanza.
 *
 * Se llama `requestSession` y no `currentSession` para no confundirse con
 * `AuthProvider.currentSession()`, que es la del NAVEGADOR y sale de otro sitio.
 */
export const requestSession = cache(async (): Promise<AuthSession | null> => {
  return getServerBackend().session.sessionFor(new Headers(await headers()));
});
