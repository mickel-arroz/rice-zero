import { AUTH_ROUTE_MOUNT } from "@/lib/backend/ports/session";

export const APP_NAME = "RICE(0)";

export const APP_DESCRIPTION =
  "Vuelca tus ideas de proyecto en un árbol de nodos y transforma cada versión en prompts estructurados para agentes de IA.";

/** El origen del nombre. Aparece en la landing y en /about. */
export const NAME_STORY =
  "«Rice» es el apodo de su creador. «(0)» es el inicio de algo: el punto cero donde una idea aún puede ser cualquier cosa.";

export const TAGLINE = "Aquí nacen los proyectos.";

/** El titular del hero. Lo comparten la landing y la columna del login. */
export const HERO_TAGLINE =
  "Vuelca tus ideas en un árbol. Conviértelas en prompts.";

/** La etiqueta del marcador del hero, sin punto final. */
export const HERO_LABEL = "Aquí nacen los proyectos";

export const ROUTES = {
  home: "/",
  about: "/about",
  login: "/login",
  projects: "/projects",
  /**
   * Donde se monta el handler de auth del Proveedor de Backend activo. Lo nombra
   * el backend, no la app: la ruta existe porque el proveedor la necesita.
   */
  authApi: AUTH_ROUTE_MOUNT,
} as const;

/**
 * Las rutas que se pueden ver SIN sesión. Todo lo demás lo protege `proxy.ts`.
 *
 * Es una lista blanca y no una negra a propósito: una ruta nueva nace protegida,
 * y abrirla al público es una decisión que hay que escribir aquí. Al revés, un
 * `/projects/[id]/export` que nadie recordó añadir a la lista negra habría
 * quedado abierto sin que nada avisara.
 */
export const PUBLIC_ROUTES = [
  ROUTES.home,
  ROUTES.about,
  ROUTES.login,
  ROUTES.authApi,
] as const;

/** El parámetro con el que el login recuerda a dónde iba el usuario. */
export const NEXT_PARAM = "next";

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
 * Todo el texto de autenticación, en un sitio.
 *
 * Está junto y no repartido por los componentes porque «los errores y los
 * estados en español» es un criterio de aceptación, y un criterio que vive en
 * doce archivos no se puede revisar de una lectura.
 */
export const AUTH_COPY = {
  label: "Autenticación",
  lead: "Tu cuenta guarda tus Proyectos. Solo tú puedes verlos y editarlos.",
  google: "Continuar con Google",
  emailLabel: "Email",
  emailPlaceholder: "tu@correo.com",
  passwordPlaceholder: "········",
  showPassword: "Mostrar la contraseña",
  hidePassword: "Ocultar la contraseña",
  passwordHint: (min: number) =>
    `Mínimo ${min} caracteres. Te enviaremos un correo de confirmación: sin confirmar no se puede entrar.`,
  /** El botón cuando el fallo es reintentable, y solo entonces. */
  retry: "Reintentar",
  aboutLink: "¿Qué es RICE(0)? →",
  /** Solo en escritorio: la columna que acompaña al formulario. */
  heroLead:
    "Entra para abrir tus Proyectos. Cada Proyecto es privado: las políticas del backend solo dejan ver lo que es tuyo.",
  confirmLabel: "Repite la contraseña",
  forgotPassword: "¿Olvidaste tu contraseña?",

  signIn: {
    tab: "Entrar",
    title: "Entrar",
    submit: "Entrar",
    pending: "Entrando",
    divider: "o con tu email",
    passwordLabel: "Contraseña",
  },
  signUp: {
    tab: "Crear cuenta",
    title: "Crear cuenta",
    submit: "Crear cuenta",
    pending: "Creando",
    divider: "o regístrate con email",
    passwordLabel: "Contraseña nueva",
  },

  sentLabel: "Cuenta creada",
  sentTitle: "Revisa tu correo",
  sentToLabel: "Enviado a",
  sentBody:
    "Abre el enlace del correo para confirmar la cuenta. Hasta que lo hagas, entrar está bloqueado.",
  sentSpam:
    "Si no llega en unos minutos, mira en spam. Al intentar entrar sin confirmar te reenviamos el correo.",
  sentCta: "Ir a Entrar",
} as const;

/** El texto de la ruta protegida que demuestra la sesión. */
export const PROJECTS_COPY = {
  label: "Ruta protegida",
  title: "Proyectos",
  sessionLabel: "Sesión activa",
  verified: "Email confirmado",
  signOut: "Cerrar sesión",
  signingOut: "Saliendo",
  emptyTitle: "Aún no hay Proyectos.",
  emptyBody: "Tu próximo proyecto empieza con un nodo.",
  emptyCta: "Nuevo proyecto",
} as const;
