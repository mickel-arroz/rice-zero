export const APP_NAME = "RICE(0)";

export const APP_DESCRIPTION =
  "Vuelca tus ideas de proyecto en un árbol de nodos y transforma cada versión en prompts estructurados para agentes de IA.";

/** El origen del nombre. Aparece en la landing y en /about. */
export const NAME_STORY =
  "«Rice» es el apodo de su creador. «(0)» es el inicio de algo: el punto cero donde una idea aún puede ser cualquier cosa.";

export const TAGLINE = "Aquí nacen los proyectos.";

export const ROUTES = {
  home: "/",
  about: "/about",
  login: "/login",
  projects: "/projects",
} as const;

export const EXTERNAL_LINKS = {
  repo: "https://github.com/mickel-arroz/rice-zero",
  portfolio: "https://portfolio-mickel-arroz.vercel.app/",
  linkedin: "https://www.linkedin.com/in/mickel-arroz",
} as const;

export const THEMES = {
  light: "light",
  dark: "dark",
  system: "system",
} as const;

export const THEME_TOGGLE_LABEL = "Cambiar entre tema claro y oscuro";

/** Geometría, ritmo y presencia del fondo de puntos. */
export const DOT_PATTERN = {
  dotSize: 2,
  gap: 24,
  proximity: 120,
  waveSpeed: 0.5,
  /** Opacidad en reposo: un mínimo más un jitter aleatorio por punto. */
  restOpacity: 0.14,
  restOpacityJitter: 0.1,
  /** Cuánto se enciende un punto al acercarse el cursor. */
  glowOpacity: 0.4,
  glowIntensity: 0.5,
} as const;

/**
 * Tokens de `globals.css` que el fondo de puntos lee en tiempo de ejecución.
 * El halo es el rojo de marca: un único acento para toda la app.
 */
export const DOT_PATTERN_TOKENS = {
  base: "--dot-base",
  glow: "--primary",
} as const;

/**
 * Variables de entorno que la app consume. Los valores `NEXT_PUBLIC_*` se
 * incrustan en el bundle en tiempo de build, así que `lib/env.ts` debe
 * referenciarlos literalmente; estas constantes existen para nombrarlas en
 * mensajes de error, tests y el wizard de configuración.
 */
export const ENV_KEYS = {
  supabaseUrl: "NEXT_PUBLIC_SUPABASE_URL",
  supabasePublishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const;

/** Ruta del wizard que deja `.env.local` y Vercel listos. */
export const SETUP_WIZARD_PATH = "scripts/setup-wizard.sh";
