import type { Metadata } from "next";
import { DotPattern } from "@/components/backgrounds/dot-pattern";
import { ArrowUpRightIcon } from "@/components/icons/arrow-up-right-icon";
import {
  CARD_CLASS,
  LABEL_CLASS,
  SiteFooter,
  SiteHeader,
} from "@/components/layout/site-chrome";
import { APP_NAME, EXTERNAL_LINKS, NAME_STORY, TAGLINE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Acerca de",
  description: `El manifiesto de ${APP_NAME}, su stack técnico y los enlaces de su creador.`,
};

const HERO_STATEMENT = "Toda idea empieza siendo un desorden.";

const HERO_LEAD =
  "RICE(0) es donde ese desorden se vuelve un árbol de nodos de texto — y cada versión del árbol, un prompt estructurado que un agente de IA puede ejecutar.";

const LOOP = [
  {
    ordinal: "01",
    title: "Vuelca",
    description:
      "Cada idea es un Nodo de texto. Varias raíces por Versión, subnodos sin límite, nada más que texto.",
  },
  {
    ordinal: "02",
    title: "Clona",
    description:
      "Clonar una Versión crea un snapshot profundo e independiente. Todas siguen editables; nunca hay merge.",
  },
  {
    ordinal: "03",
    title: "Analiza",
    description:
      "La IA lee el árbol serializado y devuelve resumen, preguntas de clarificación y features estructuradas.",
  },
  {
    ordinal: "04",
    title: "Ejecuta",
    description:
      "Master Prompt y Feature Prompts en texto plano: al portapapeles o descargados como .md.",
  },
] as const;

const VIEWS = [
  {
    scope: "Escritorio",
    title: "Vista Canvas",
    description:
      "El árbol como diagrama, con layout siempre automático: arrastrar re-parenta, nunca decora. En móvil es solo consulta — pan, zoom y leer.",
  },
  {
    scope: "Móvil y escritorio",
    title: "Vista Registro",
    description:
      "Inputs de texto unidos por líneas y operados solo con botones: crear, mover, re-parentar, reordenar, borrar. El modo de edición completo en el teléfono.",
  },
] as const;

const HIGHLIGHTS = [
  {
    title: "Autoguardado",
    description:
      "No hay botón de guardar. Cada cambio mínimo se persiste en el momento.",
  },
  {
    title: "Tus directrices mandan",
    description:
      "El texto que escribes antes de generar se inyecta con máxima precedencia sobre el resto del prompt.",
  },
  {
    title: "Privado por defecto",
    description:
      "RLS a nivel de fila: solo el creador de un Proyecto puede verlo y editarlo.",
  },
  {
    title: "Instalable y offline",
    description:
      "PWA con manifest y service worker. Sin conexión puedes consultar lo ya navegado; la edición se bloquea y reconecta sola.",
  },
  {
    title: "El árbol nunca se corrompe",
    description:
      "Mover un Nodo bajo sí mismo o bajo un descendiente es imposible por diseño.",
  },
  {
    title: "En español, prompts en tu idioma",
    description:
      "La interfaz es toda en español; los prompts salen en el idioma del contenido de tu árbol.",
  },
] as const;

const STACK = [
  {
    ordinal: "01",
    title: "Next.js 16",
    description:
      "App Router, Server Components y Turbopack. Tailwind v4 CSS-first: los tokens viven en globals.css.",
  },
  {
    ordinal: "02",
    title: "Supabase",
    description:
      "Postgres y Auth — Google y email con confirmación. RLS owner-only en todas las tablas.",
  },
  {
    ordinal: "03",
    title: "Gemini",
    description:
      "Primer Proveedor de IA tras una fábrica normalizada; cada respuesta se valida por schema antes de guardarse.",
  },
  {
    ordinal: "04",
    title: "@xyflow/react",
    description:
      "La Vista Canvas, con auto-layout. Ningún Nodo guarda posición: el diagrama se ordena solo.",
  },
  {
    ordinal: "05",
    title: "Zustand",
    description:
      "Estado en cliente. El store de IA es independiente del árbol: generar nunca bloquea la edición.",
  },
  {
    ordinal: "06",
    title: "NDot 57 + Iosevka",
    description:
      "Tipografía Nothing OS servida en local, cero CDNs: matriz de puntos para display, monoespaciada para el resto.",
  },
] as const;

const LIMITS = [
  "Adjuntos de cualquier tipo. Solo texto.",
  "Merge entre Versiones. Clonar es una bifurcación definitiva.",
  "Colaboración en tiempo real, compartir o presencia.",
  "Editar sin conexión. Offline es solo lectura.",
] as const;

const CREATOR_LINKS = [
  {
    kind: "Portafolio",
    title: "portfolio-mickel-arroz",
    description:
      "Trabajo, experimentos y otras cosas que empezaron en un nodo cero.",
    href: EXTERNAL_LINKS.portfolio,
  },
  {
    kind: "LinkedIn",
    title: "in/mickel-arroz",
    description: "Trayectoria profesional y por dónde ando ahora.",
    href: EXTERNAL_LINKS.linkedin,
  },
  {
    kind: "GitHub",
    title: "mickel-arroz/rice-zero",
    description: "El código de RICE(0), abierto y en curso.",
    href: EXTERNAL_LINKS.repo,
  },
] as const;

const SECTION_CLASS = "flex flex-col gap-4 px-6 pt-10 lg:px-16 lg:pt-0 lg:pb-14";

const ORDINAL_CLASS = "font-display text-[15px] text-primary";

const ROW_CLASS =
  "flex gap-4 border-t border-border py-5 lg:py-0 lg:pt-4 lg:pb-0";

export default function About() {
  return (
    <>
      <DotPattern />

      <div className="relative z-10 flex flex-1 flex-col">
        <SiteHeader current="about" />

        <main className="flex flex-1 flex-col">
          <section className="flex flex-col gap-5 px-6 pt-11 pb-10 lg:items-center lg:gap-6 lg:px-16 lg:pt-22 lg:pb-18 lg:text-center">
            <p className="flex items-center gap-2">
              <span
                className="size-2 rounded-full bg-primary"
                aria-hidden="true"
              />
              <span className={`${LABEL_CLASS} lg:text-xs`}>Acerca de</span>
            </p>
            <h1 className="text-[44px] leading-none tracking-[0.02em] lg:text-[88px]">
              MANIFIESTO
            </h1>
            <h2 className="max-w-2xl text-[22px] leading-tight font-bold text-pretty lg:text-3xl">
              {HERO_STATEMENT}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground lg:text-[15px]">
              {HERO_LEAD}
            </p>
          </section>

          <section className="flex flex-col gap-10 px-6 lg:flex-row lg:items-start lg:gap-8 lg:px-16 lg:pb-14">
            <div className={`${CARD_CLASS} flex flex-col gap-4 p-7 lg:flex-1`}>
              <span className={LABEL_CLASS}>El nombre</span>
              <p className="text-[19px] leading-normal text-pretty lg:text-xl">
                {NAME_STORY}
              </p>
              <p className="font-display text-[15px] text-primary lg:text-base">
                {TAGLINE}
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:flex-2">
              <span className={LABEL_CLASS}>El bucle</span>
              <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8">
                {LOOP.map((step) => (
                  <div key={step.ordinal} className={ROW_CLASS}>
                    <span className={ORDINAL_CLASS}>{step.ordinal}</span>
                    <div className="flex flex-col gap-1.5 lg:gap-2">
                      <h3 className="text-base font-bold lg:text-[17px]">
                        {step.title}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <span className={LABEL_CLASS}>Dos vistas, un mismo árbol</span>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-8">
              {VIEWS.map((view) => (
                <div
                  key={view.title}
                  className={`${CARD_CLASS} flex flex-col gap-2 p-6 lg:p-7`}
                >
                  <span className={LABEL_CLASS}>{view.scope}</span>
                  <h3 className="text-[17px] font-bold lg:text-lg">
                    {view.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
                    {view.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <span className={LABEL_CLASS}>Claves</span>
            <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-8">
              {HIGHLIGHTS.map((highlight) => (
                <div
                  key={highlight.title}
                  className="flex flex-col gap-1.5 border-t border-border py-4 lg:gap-2 lg:py-0 lg:pt-4"
                >
                  <h3 className="text-[15px] font-bold lg:text-base">
                    {highlight.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <span className={LABEL_CLASS}>Stack técnico</span>
            <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-8">
              {STACK.map((item) => (
                <div key={item.ordinal} className={ROW_CLASS}>
                  <span className={ORDINAL_CLASS}>{item.ordinal}</span>
                  <div className="flex flex-col gap-1.5 lg:gap-2">
                    <h3 className="text-base font-bold lg:text-[17px]">
                      {item.title}
                    </h3>
                    <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="px-6 pt-10 lg:px-16 lg:pt-0 lg:pb-14">
            <div
              className={`${CARD_CLASS} flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:gap-8 lg:p-7`}
            >
              <span className={`${LABEL_CLASS} lg:w-50 lg:shrink-0 lg:pt-1`}>
                Lo que {APP_NAME} no hace
              </span>
              <ul className="flex flex-col gap-2.5 lg:grid lg:flex-1 lg:grid-cols-2 lg:gap-x-8 lg:gap-y-3">
                {LIMITS.map((limit) => (
                  <li
                    key={limit}
                    className="flex gap-2.5 text-[13px] leading-relaxed text-muted-foreground"
                  >
                    <span className="text-primary" aria-hidden="true">
                      —
                    </span>
                    <span className="text-pretty">{limit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <span className={LABEL_CLASS}>El creador</span>
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-8">
              {CREATOR_LINKS.map((link) => (
                <a
                  key={link.kind}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${CARD_CLASS} flex items-start justify-between gap-4 p-6 hover:text-primary lg:p-7`}
                >
                  <span className="flex flex-col gap-2">
                    <span className={LABEL_CLASS}>{link.kind}</span>
                    <span className="text-[17px] font-bold lg:text-lg">
                      {link.title}
                    </span>
                    <span className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                  <ArrowUpRightIcon className="mt-0.5 shrink-0" />
                </a>
              ))}
            </div>
          </section>
        </main>

        <SiteFooter current="about" />
      </div>
    </>
  );
}
