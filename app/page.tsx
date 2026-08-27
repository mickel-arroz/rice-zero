import Link from "next/link";
import {
  CARD_CLASS,
  CTA_PRIMARY_CLASS,
  LABEL_CLASS,
  LINK_CLASS,
  PAGE_CLASS,
  SiteFooter,
  SiteHeader,
} from "@/components/layout/site-chrome";
import {
  APP_DESCRIPTION,
  APP_NAME,
  HERO_TAGLINE,
  NAME_STORY,
  ROUTES,
  TAGLINE,
} from "@/lib/constants";

const FEATURES = [
  {
    ordinal: "01",
    title: "Árbol de nodos",
    description:
      "Cada idea es un nodo de texto con padre e hijos. Añade subnodos y reordena sin perder nada.",
  },
  {
    ordinal: "02",
    title: "Versiones independientes",
    description:
      "Clona una versión para explorar otro camino. Cada línea del árbol es siempre editable.",
  },
  {
    ordinal: "03",
    title: "Prompts por IA",
    description:
      "Envía una versión a la IA y recibe un Master Prompt y Feature Prompts listos para tu agente de código.",
  },
] as const;

export default function Home() {
  return (
    <div className={PAGE_CLASS}>
      <SiteHeader current="home" />

      <main className="flex flex-1 flex-col">
        <section className="flex flex-col gap-5 px-6 pt-11 pb-10 lg:items-center lg:gap-6 lg:px-16 lg:pt-22 lg:pb-18 lg:text-center">
          <p className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-primary"
              aria-hidden="true"
            />
            <span className={`${LABEL_CLASS} lg:text-xs`}>
              Aquí nacen los proyectos
            </span>
          </p>
          <h1 className="text-[56px] leading-none tracking-[0.02em] lg:text-[104px]">
            {APP_NAME}
          </h1>
          <h2 className="max-w-2xl text-2xl leading-tight font-bold lg:text-3xl">
            {HERO_TAGLINE}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground lg:text-[15px]">
            {APP_DESCRIPTION}
          </p>
          {/* Una sola acción: /login ya ofrece crear cuenta en su propio
              conmutador, así que un segundo CTA competía con el primero sin
              llevar a ningún sitio distinto. */}
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <Link href={ROUTES.login} className={CTA_PRIMARY_CLASS}>
              Entrar
            </Link>
          </div>
          <Link
            href={ROUTES.about}
            className={`mt-1.5 self-center text-[13px] lg:hidden ${LINK_CLASS}`}
          >
            ¿Qué es {APP_NAME}? →
          </Link>
        </section>

        <section className="flex flex-col gap-10 px-6 pb-4 lg:flex-row lg:gap-8 lg:px-16 lg:pb-14">
          <div className={`${CARD_CLASS} flex flex-col gap-4 p-7 lg:flex-1`}>
            <span className={LABEL_CLASS}>Manifiesto</span>
            <p className="text-[19px] leading-normal lg:text-xl">
              {NAME_STORY}
            </p>
            <p className="font-display text-[15px] text-primary lg:text-base">
              {TAGLINE}
            </p>
          </div>
          <div className="flex flex-col lg:grid lg:flex-2 lg:grid-cols-3 lg:gap-8">
            <span className={`${LABEL_CLASS} pb-4 lg:hidden`}>Qué hace</span>
            {FEATURES.map((feature) => (
              <div
                key={feature.ordinal}
                className="flex gap-4 border-t border-border py-5 lg:flex-col lg:gap-2.5 lg:pb-0"
              >
                <span className="font-display text-[15px] text-primary">
                  {feature.ordinal}
                </span>
                <div className="flex flex-col gap-1.5 lg:gap-2.5">
                  <h3 className="text-base font-bold lg:text-[17px]">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-6 mt-4 flex flex-col gap-4 rounded-[20px] bg-accent p-7 text-accent-foreground lg:hidden">
          <span className={LABEL_CLASS}>Nodo cero</span>
          <p className="text-xl leading-snug font-bold">
            Tu próximo proyecto empieza con un nodo.
          </p>
          <Link href={ROUTES.login} className={CTA_PRIMARY_CLASS}>
            Entrar
          </Link>
        </section>
      </main>

      <SiteFooter current="home" />
    </div>
  );
}
