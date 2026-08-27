import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  PAGE_CLASS,
  SiteFooter,
  SiteHeader,
} from "@/components/layout/site-chrome";
import { safeNextPath } from "@/lib/auth/routes";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import { APP_NAME, NEXT_PARAM, ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Entrar",
  description: `Entra en ${APP_NAME} o crea tu cuenta para abrir tus Proyectos.`,
  /** Un formulario de login no aporta nada en un buscador. */
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params[NEXT_PARAM];
  // El destino se filtra AQUÍ, en el servidor, y llega al formulario ya limpio:
  // así el cliente no puede acabar redirigiendo a un sitio que no sea nuestro.
  const destination =
    safeNextPath(Array.isArray(raw) ? raw[0] : raw) ?? ROUTES.projects;

  // Quien ya puede entrar no tiene nada que hacer aquí. `proxy.ts` no protege
  // esta ruta —es pública a propósito, para poder mostrar el formulario—, así
  // que el reenvío se decide en la página.
  //
  // `canAct` y no `session !== null`: a quien tiene sesión pero no ha confirmado
  // el email hay que DEJARLO aquí. Intentar entrar es justo lo que le reenvía el
  // correo de confirmación; reenviarlo a /projects sería un bucle de redirects.
  if (canAct(await requestSession())) redirect(destination);

  return (
    <div className={PAGE_CLASS}>
      <SiteHeader current="login" />
      <main className="flex flex-1 flex-col justify-center px-6 py-6 lg:items-center lg:px-16">
        <div className="w-full lg:max-w-[440px]">
          <LoginForm destination={destination} />
        </div>
      </main>
      <SiteFooter current="login" />
    </div>
  );
}
