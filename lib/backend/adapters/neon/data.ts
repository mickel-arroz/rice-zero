/**
 * El cliente del Data API de Neon. Ahora vive en el SERVIDOR.
 *
 * Hasta el ADR 0006 esta mitad la construía `client.ts` dentro del navegador y
 * el JWT viajaba hasta allí. Ya no: quien habla PostgREST es una ruta de esta
 * aplicación, y el navegador solo ve `/api/*`.
 *
 * Lo que NO cambia, y es la mitad del valor de haberlo hecho así: el token
 * sigue siendo el del usuario, así que la autorización sigue siendo RLS. Aquí
 * no hay `DATABASE_URL` ni ningún rol con BYPASSRLS, y no puede haberlo — con
 * uno de esos, cada ruta pasaría a ser la última línea de defensa y las
 * políticas del ADR 0001 quedarían de adorno.
 */

import { createClient, type NeonPostgrestClient } from "@neondatabase/neon-js";

import type { Database } from "@/lib/backend/adapters/neon/database.types";
import { requireEnv } from "@/lib/backend/env";

/**
 * La URL del Data API. Ya NO es `NEXT_PUBLIC_`.
 *
 * El renombrado no es cosmético: mientras la variable llevara el prefijo, Next
 * la incrustaba en el bundle y cualquiera podía reconstruir el cliente de datos
 * en el navegador sin que nada fallara. Quitarlo es lo que convierte «el
 * navegador no habla con Neon» en una propiedad de la build y no en una
 * costumbre. (No es un secreto: la URL sigue protegida por JWT y RLS. Es que ya
 * no la necesita nadie en el cliente.)
 */
export const NEON_DATA_ENV_KEY = "NEON_DATA_API_URL";

/**
 * Lo que el `RowStore` necesita de un cliente, y nada más.
 *
 * Antes pedía el `NeonBrowserClient` entero, que además traía el cliente de
 * auth. Estrecharlo es lo que permite que el MISMO store —con su reintento del
 * tropiezo del #41 incluido— corra en el servidor sin tocar una línea.
 */
export type NeonDataClient = {
  readonly data: NeonPostgrestClient<Database>;
  /**
   * Olvida el token cacheado. Lo llama `retryOnce` ante el tropiezo de sesión:
   * no consta que el token sea la causa, pero el reintento tiene que ser el
   * intento más limpio posible.
   */
  forgetToken(): void;
};

/**
 * Un cliente para UNA petición.
 *
 * Se construye uno por petición y no se memoiza a nivel de módulo. Es
 * deliberado y es la regla que evita el peor fallo posible de esta capa: un
 * cliente compartido lleva dentro un `getToken`, y un `getToken` compartido
 * acaba sirviéndole a alguien el token de otro. `createClient` es barato; lo
 * que sí se cachea —el token, con su cookie como clave— está fuera de aquí.
 */
export function createNeonDataClient(
  getToken: () => Promise<string | null>,
  forgetToken: () => void,
): NeonDataClient {
  const data = createClient<Database>({
    dataApi: {
      url: requireEnv(
        NEON_DATA_ENV_KEY,
        process.env.NEON_DATA_API_URL,
        "Ejecuta `bash scripts/setup-neon.sh` para generar .env.local.",
      ),
      getToken,
    },
  });
  return { data, forgetToken };
}
