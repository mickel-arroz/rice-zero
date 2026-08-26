import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Una cookie que `@supabase/ssr` quiere escribir tras refrescar la sesión. */
export type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Cliente de Supabase para el servidor, atado a las cookies de *esta*
 * petición.
 *
 * Se construye uno nuevo por render a propósito: compartir el cliente entre
 * peticiones serviría la sesión de una persona a otra. Por eso es una función
 * y no un módulo con estado.
 *
 * Solo la capa de servicios debe llamarla; los componentes y páginas reciben
 * datos ya resueltos.
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = readSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: CookieToSet[]) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component no puede escribir cookies: Next lanza aquí, y
          // tragarlo mantiene vivo el render. El precio es que el refresco de
          // sesión tiene que ocurrir en otro sitio: `proxy.ts` (ticket #7) es
          // quien debe renovar el token y escribir las cookies en la
          // respuesta. Hasta que exista, una sesión caducada no se renueva.
        }
      },
    },
  });
}
