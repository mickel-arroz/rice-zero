import { ENV_KEYS, SETUP_WIZARD_PATH } from "@/lib/constants";

/**
 * Falta una variable de entorno obligatoria. Se distingue de un error
 * cualquiera para que la capa de servicios pueda tratarla como un fallo de
 * configuración (irrecuperable en runtime) y no como un fallo de red.
 */
export class MissingEnvError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(
      `Falta la variable de entorno ${key}. Ejecuta \`bash ${SETUP_WIZARD_PATH}\` para generar .env.local.`,
    );
    this.name = "MissingEnvError";
    this.key = key;
  }
}

/**
 * Exige un valor no vacío. Nunca incluye el valor recibido en el error: una
 * variable ausente puede ser un secreto mal copiado y los errores acaban en
 * logs.
 */
export function requireEnv(key: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new MissingEnvError(key);
  return trimmed;
}

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

/**
 * Credenciales públicas de Supabase, las mismas en navegador y en servidor:
 * la clave publicable es pública por diseño, porque toda la autorización vive
 * en las políticas RLS y no en la clave.
 */
export function readSupabasePublicEnv(): SupabasePublicEnv {
  return {
    url: requireEnv(ENV_KEYS.supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishableKey: requireEnv(
      ENV_KEYS.supabasePublishableKey,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
