import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  PAGE_CLASS,
  SiteFooter,
  SiteHeader,
} from "@/components/layout/site-chrome";
import { resetTokenFrom } from "@/lib/backend/ports";
import { APP_NAME, AUTH_COPY } from "@/lib/constants";

export const metadata: Metadata = {
  title: AUTH_COPY.reset.title,
  description: `Pon una contraseña nueva para tu cuenta de ${APP_NAME}.`,
  /**
   * Y aquí `noindex` no es higiene, es lo mínimo: la URL LLEVA UN TOKEN dentro.
   * Indexarla dejaría una credencial de un solo uso en un buscador.
   */
  robots: { index: false, follow: false },
};

/** El token viaja en la URL, así que no hay nada que prerenderizar. */
export const dynamic = "force-dynamic";

/**
 * La pantalla a la que aterriza el enlace del correo.
 *
 * Es pública (`PUBLIC_ROUTES`) y no comprueba la sesión: quien llega aquí no
 * puede entrar —justamente por eso pidió el enlace—, y la credencial que trae
 * es el token, no una cookie. Tampoco reenvía a quien SÍ tenga sesión: el
 * enlace es de quien tiene el correo abierto, y echarlo a `/projects` por estar
 * ya dentro le quitaría la única forma de terminar lo que empezó.
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const params = await searchParams;

  // Se normaliza a `URLSearchParams` porque el puerto habla estándares web, no
  // la forma que Next le da a los parámetros. Quién decide CUÁL es el token es
  // él: el nombre lo pone cada proveedor —`token` en Better Auth, el `code` de
  // PKCE en Supabase—, y esta página no tiene por qué saberlo.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }

  return (
    <div className={PAGE_CLASS}>
      <SiteHeader current="login" />
      <main className="flex flex-1 flex-col justify-center px-6 py-6 lg:px-16">
        {/* El mismo tope de 440 que el login: es el mismo formulario corto, y
            estirarlo a lo ancho de la ventana dejaría campos absurdamente
            largos para lo poco que se escribe en ellos. */}
        <div className="mx-auto w-full max-w-110">
          <ResetPasswordForm token={resetTokenFrom(query)} />
        </div>
      </main>
      <SiteFooter current="login" />
    </div>
  );
}
