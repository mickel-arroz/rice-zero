/**
 * La mitad de servidor del adaptador de Supabase. Dormida pero compilando.
 *
 * Aquí la asimetría con Neon es real y vale la pena nombrarla: Supabase NO
 * necesita ninguna ruta montada. Su cliente de navegador escribe las cookies
 * `sb-*` en NUESTRO dominio desde el primer momento, así que ya son de primera
 * parte y el servidor las ve sin proxy. `authRoute` es `null` por eso, no por
 * estar a medias — y es lo que justifica que el puerto lo declare opcional.
 *
 * El guardia sí hace una llamada de red (`getUser`), al contrario que el de
 * Neon: las cookies de Supabase no vienen firmadas por nosotros, así que la
 * única forma de saber si la sesión es buena es preguntárselo al servidor de
 * auth. Es la recomendación de la propia documentación de Supabase para el
 * middleware.
 */

import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

import { SUPABASE_ENV_KEYS } from "@/lib/backend/adapters/supabase/client";
import type { Database } from "@/lib/backend/adapters/supabase/database.types";
import { requireEnv } from "@/lib/backend/env";
import type {
  AuthSession,
  SessionGate,
  SessionGuard,
  ServerBackendProvider,
} from "@/lib/backend/ports";

const SETUP_HINT =
  "Ejecuta `bash scripts/setup-supabase.sh` para generar .env.local.";

type SupabaseServerConfig = {
  readonly url: string;
  readonly publishableKey: string;
};

function readConfig(): SupabaseServerConfig {
  return {
    url: requireEnv(
      SUPABASE_ENV_KEYS.url,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      SETUP_HINT,
    ),
    publishableKey: requireEnv(
      SUPABASE_ENV_KEYS.publishableKey,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      SETUP_HINT,
    ),
  };
}

function toAuthSession(user: User): AuthSession {
  // Igual que en el cliente: Supabase deja el perfil social crudo en
  // `user_metadata`, con las claves que puso el proveedor.
  const meta = user.user_metadata as Record<string, unknown> | null;
  const text = (key: string) =>
    typeof meta?.[key] === "string" && meta[key] ? (meta[key] as string) : null;

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      emailVerified: user.email_confirmed_at != null,
      name: text("full_name") ?? text("name"),
      image: text("avatar_url") ?? text("picture"),
    },
  };
}

/**
 * Un cliente por petición, más la lista de cookies que quiera sentar.
 *
 * El SDK refresca el token por su cuenta y avisa por `setAll`; recogerlas y
 * devolverlas es lo que impide que la sesión caduque a mitad de una visita.
 */
function clientFor(headers: Headers, config: SupabaseServerConfig) {
  const pending: string[] = [];
  const client = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          const header = headers.get("cookie") ?? "";
          return parseCookieHeader(header).map(({ name, value }) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            pending.push(serializeCookieHeader(name, value, options ?? {}));
          }
        },
      },
    },
  );
  return { client, pending };
}

/**
 * La vuelta de un proveedor OAuth trae `?code=` (PKCE) o `?error=`, y llega
 * todavía SIN sesión: bloquearla dejaría el login con Google sin terminar
 * nunca. El canje lo hace el cliente del navegador al cargar la página
 * (`detectSessionInUrl`), no el servidor, así que aquí solo hay que dejarla
 * pasar.
 *
 * Es el equivalente del `redirect_oauth` de Neon, resuelto en el otro extremo
 * porque los dos proveedores completan OAuth en sitios distintos.
 */
function isOAuthReturn(url: URL): boolean {
  return url.searchParams.has("code") || url.searchParams.has("error");
}

function createSupabaseSessionGuard(
  config: SupabaseServerConfig,
): SessionGuard {
  async function userFor(headers: Headers): Promise<User | null> {
    try {
      const { client } = clientFor(headers, config);
      const { data, error } = await client.auth.getUser();
      if (error) return null;
      return data.user;
    } catch {
      // El puerto promete que esto no lanza: sin sesión legible, no hay sesión.
      return null;
    }
  }

  return {
    needsGateOnPublicPath(request) {
      return isOAuthReturn(new URL(request.url));
    },

    async sessionFor(headers) {
      const user = await userFor(headers);
      return user ? toAuthSession(user) : null;
    },

    async gate(request, { loginUrl }): Promise<SessionGate> {
      const { client, pending } = clientFor(request.headers, config);

      // `publicPaths` no se usa: `proxy.ts` ya descartó las rutas públicas antes
      // de llamar, y este adaptador no tiene ninguna lógica de rutas propia que
      // componer con ellas. Neon sí las necesita, porque su SDK decide por su
      // cuenta a qué rutas exigir sesión.
      if (isOAuthReturn(new URL(request.url))) {
        return { kind: "allow", setCookies: pending, requestHeaders: {} };
      }

      let user: User | null = null;
      try {
        const { data, error } = await client.auth.getUser();
        if (!error) user = data.user;
      } catch {
        user = null;
      }

      return user
        ? { kind: "allow", setCookies: pending, requestHeaders: {} }
        : { kind: "redirect", to: loginUrl, setCookies: pending };
    },
  };
}

export function createSupabaseServerBackend(): ServerBackendProvider {
  const config = readConfig();
  return {
    name: "supabase",
    session: createSupabaseSessionGuard(config),
    authRoute: null,
  };
}
