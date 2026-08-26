import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  APP_DESCRIPTION,
  APP_NAME,
  EXTERNAL_LINKS,
  ROUTES,
} from "@/lib/constants";

const HERO_TAGLINE = "Vuelca tus ideas en un árbol. Conviértelas en prompts.";

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

const LABEL_CLASS =
  "text-[11px] uppercase tracking-[0.18em] text-muted-foreground";

const LINK_CLASS =
  "underline decoration-dotted underline-offset-4 decoration-muted-foreground hover:text-primary";

const CTA_CLASS =
  "flex h-13 items-center justify-center rounded-full text-[15px] font-bold uppercase tracking-[0.08em] lg:h-14 lg:px-10";

const CTA_PRIMARY_CLASS = `${CTA_CLASS} bg-primary text-primary-foreground hover:opacity-90`;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-16">
        <span className="font-display text-[21px] tracking-[0.04em] lg:text-[22px]">
          {APP_NAME}
        </span>
        <div className="flex items-center gap-5">
          <Link
            href={ROUTES.about}
            className={`hidden text-sm ${LINK_CLASS} sm:inline`}
          >
            Acerca de
          </Link>
          <ThemeToggle />
        </div>
      </header>

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
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <Link
              href={ROUTES.login}
              className={CTA_PRIMARY_CLASS}
            >
              Entrar
            </Link>
            <Link
              href={ROUTES.login}
              className={`${CTA_CLASS} border border-border hover:border-muted-foreground`}
            >
              Crear cuenta
            </Link>
          </div>
          <Link
            href={ROUTES.about}
            className={`mt-1.5 self-center text-[13px] ${LINK_CLASS} lg:hidden`}
          >
            ¿Qué es {APP_NAME}? →
          </Link>
        </section>

        <section className="flex flex-col gap-10 px-6 pb-4 lg:flex-row lg:gap-8 lg:px-16 lg:pb-14">
          <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-7 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px] lg:flex-1">
            <span className={LABEL_CLASS}>Manifiesto</span>
            <p className="text-[19px] leading-normal lg:text-xl">
              «Rice» es el apodo de su creador. «(0)» es el inicio de algo: el
              punto cero donde una idea aún puede ser cualquier cosa.
            </p>
            <p className="font-display text-[15px] text-primary lg:text-base">
              Aquí nacen los proyectos.
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
          <Link
            href={ROUTES.login}
            className={CTA_PRIMARY_CLASS}
          >
            Entrar
          </Link>
        </section>
      </main>

      <footer className="mt-10 flex flex-col gap-2.5 border-t border-border px-6 py-6 lg:mt-0 lg:flex-row-reverse lg:items-center lg:justify-between lg:px-16">
        <div className="flex gap-4 text-[13px] lg:gap-5">
          <Link href={ROUTES.about} className={LINK_CLASS}>
            Acerca de
          </Link>
          <a
            href={EXTERNAL_LINKS.repo}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            GitHub
          </a>
        </div>
        <span className="text-xs text-muted-foreground">
          © 2026 {APP_NAME}
        </span>
      </footer>
    </div>
  );
}
