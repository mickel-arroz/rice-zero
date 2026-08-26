export const APP_NAME = "RICE(0)";

export const APP_DESCRIPTION =
  "Vuelca tus ideas de proyecto en un árbol de nodos y transforma cada versión en prompts estructurados para agentes de IA.";

export const ROUTES = {
  home: "/",
  about: "/about",
  login: "/login",
  projects: "/projects",
} as const;

export const EXTERNAL_LINKS = {
  repo: "https://github.com/mickel-arroz/rice-zero",
  github: "https://github.com/mickel-arroz",
  // TODO: URLs reales de portafolio y LinkedIn antes del ticket de /about
  portfolio: "https://github.com/mickel-arroz",
  linkedin: "https://github.com/mickel-arroz",
} as const;

export const THEMES = {
  light: "light",
  dark: "dark",
  system: "system",
} as const;

export const THEME_TOGGLE_LABEL = "Cambiar entre tema claro y oscuro";
