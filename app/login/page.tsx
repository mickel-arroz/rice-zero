import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import {
  LABEL_CLASS,
  PAGE_CLASS,
  SiteFooter,
  SiteHeader,
} from "@/components/layout/site-chrome";
import { safeNextPath } from "@/lib/auth/routes";
import { requestSession } from "@/lib/auth/session";
import { canAct } from "@/lib/backend/ports";
import {
  APP_NAME,
  AUTH_COPY,
  HERO_LABEL,
  HERO_TAGLINE,
  NEXT_PARAM,
  ROUTES,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Entrar",
  description: `Entra en ${APP_NAME} o crea tu cuenta para abrir tus Proyectos.`,
  /** Un formulario de login no aporta nada en un buscador. */
  robots: { index: false, follow: false },
};

/** La sesión sale de las cookies de la petición, así que nada se prerenderiza. */
export const dynamic = "force-dynamic";

/**
 * La columna que acompaña al formulario en escritorio.
 *
 * Reutiliza el hero de la landing —el mismo marcador, el mismo h1 en NDot, el
 * mismo titular— porque es la misma promesa: en una pantalla ancha el formulario
 * solo ocupa 440px y el resto quedaba vacío. En móvil no existe: ahí el
 * formulario ES la pantalla.
 */
function DesktopHero() {
  return (
    <div className="hidden max-w-[520px] flex-col gap-6 lg:flex">
      <p className="flex items-center gap-2">
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        <span className={`${LABEL_CLASS} lg:text-xs`}>{HERO_LABEL}</span>
      </p>
      <h1 className="text-[104px] leading-none tracking-[0.02em]">
        {APP_NAME}
      </h1>
      <h2 className="text-3xl leading-tight font-bold text-pretty">
        {HERO_TAGLINE}
      </h2>
      <p className="max-w-[520px] text-[15px] leading-relaxed text-pretty text-muted-foreground">
        {AUTH_COPY.heroLead}
      </p>
    </div>
  );
}

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
      <main className="flex flex-1 flex-col justify-center px-6 py-6 lg:px-16">
        {/* El par se centra y tiene tope: con `justify-between` a lo ancho de la
            ventana, en una pantalla grande el hero y el formulario acababan uno
            en cada borde con un vacío enorme en medio. 520 + 64 + 440 = 1024. */}
        <div className="mx-auto flex w-full flex-col gap-10 lg:max-w-[1024px] lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <DesktopHero />
          {/* El tope es de 440 en TODAS las anchuras y se centra por debajo de
              `lg`: en tablet el formulario se estiraba a 700px y los campos
              quedaban absurdamente largos para lo poco que se escribe en ellos. */}
          <div className="mx-auto w-full max-w-[440px] lg:mx-0 lg:w-[440px] lg:shrink-0">
            <LoginForm destination={destination} />
          </div>
        </div>
      </main>
      <SiteFooter current="login" />
    </div>
  );
}
