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
   * La pantalla de un Proyecto: su Vista Registro sobre la Versión activa.
   *
   * Es una función y no un texto porque lleva un id dentro, y aun así vive
   * aquí con las demás: «cero magic strings» incluye las rutas construidas a
   * mano, que son justo las que se escriben mal sin que nadie se entere hasta
   * pulsar. Cae BAJO `/projects`, así que la sidebar la marca activa sola.
   */
  project: (projectId: string) => `/projects/${projectId}`,
  /**
   * El árbol de UNA Versión concreta.
   *
   * La Versión va en la URL desde #14, y eso es lo que hace que recargar, el
   * botón de atrás y un enlace pegado a alguien devuelvan la Versión que se
   * estaba mirando y no «la más reciente». `ROUTES.project` sigue existiendo y
   * sigue siendo el destino del acceso directo de la sidebar: entra sin decir
   * cuál y redirige aquí, a la activa.
   */
  version: (projectId: string, versionId: string) =>
    `/projects/${projectId}/${versionId}`,
  /**
   * Donde se monta el handler de auth del Proveedor de Backend activo. Lo nombra
   * el backend, no la app: la ruta existe porque el proveedor la necesita.
   */
  authApi: AUTH_ROUTE_MOUNT,
  /**
   * La pantalla que sale cuando se pide una ruta que no está en la caché y no
   * hay red. La sirve el service worker como `fallback`, no un enlace: nadie
   * navega aquí a propósito.
   */
  offline: "/offline",
  /**
   * Donde el Route Handler de Serwist publica el service worker ya compilado.
   *
   * En el camino de Turbopack el worker NO lo genera el bundler —eso es la
   * configuración de webpack que rompe el build en Next 16— sino una ruta que
   * lo compila con esbuild. Por eso es una ruta de la app y vive aquí.
   */
  serwist: "/serwist",
  /**
   * La URL que Next publica para `app/manifest.ts`.
   *
   * La nombra el framework —el nombre del archivo decide la ruta—, pero vive
   * aquí porque la leen dos sitios que TIENEN que coincidir: la etiqueta
   * `manifest` de `app/layout.tsx` y `PUBLIC_ROUTES`.
   */
  manifest: "/manifest.webmanifest",
} as const;

/** El archivo concreto que el navegador registra como service worker. */
export const SERVICE_WORKER_URL = `${ROUTES.serwist}/sw.js`;

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
  // Las dos piezas de la PWA las pide el NAVEGADOR, no una persona con sesión.
  // El service worker se descarga antes de saber si hay usuario, y la pantalla
  // offline tiene que salir justo cuando no se puede consultar nada. Si el
  // proxy las gateara, respondería 302 a /login y el navegador recibiría HTML
  // donde espera JavaScript: el registro falla sin un solo error visible.
  // Ninguna de las dos lleva datos de nadie dentro.
  ROUTES.serwist,
  ROUTES.offline,
  // Y el manifest. Es el que menos parece una ruta y el único cuyo fallo no se
  // ve en ninguna pantalla: el navegador lo pide, recibe el HTML del login, no
  // lo puede parsear y simplemente deja de ofrecer «instalar».
  ROUTES.manifest,
] as const;

/** El parámetro con el que el login recuerda a dónde iba el usuario. */
export const NEXT_PARAM = "next";

export const EXTERNAL_LINKS = {
  repo: "https://github.com/mickel-arroz/rice-zero",
  portfolio: "https://portfolio-mickel-arroz.vercel.app/",
  linkedin: "https://www.linkedin.com/in/mickel-arroz",
} as const;

/**
 * La configuración del Proveedor de IA.
 *
 * Vive aquí y no dentro del adaptador de Gemini a propósito: el id de modelo es
 * lo que más se toca de toda la capa de IA y lo que menos tiene que ver con
 * cómo se arma la llamada. Buscarlo entre el manejo de errores del adaptador,
 * el día que Google retire un modelo, es exactamente el rato que no hay que
 * perder.
 *
 * Lo que NO está aquí es la API key. Este archivo lo importa media interfaz,
 * así que una credencial en él viajaría a todos los bundles de cliente. La lee
 * el adaptador, que es `server-only`.
 *
 * Tampoco están los topes de lo que se ACEPTA por la puerta —cuánto árbol,
 * cuánta Directriz—. Esos son `ANALYSIS_INPUT_LIMITS` en
 * `lib/services/analyses.ts`, junto a los mensajes que los explican y al mismo
 * nivel que `VERSION_LIMITS`: aquí se configura cómo se hace la llamada, no qué
 * se admite antes de hacerla.
 */
export const AI_CONFIG = {
  /**
   * Los modelos, en orden de preferencia. Se intentan de arriba abajo.
   *
   * Es una LISTA y no un modelo porque el free tier se congestiona de verdad:
   * el 2026-09-04, tres de los cuatro Flash de esta lista contestaban
   * `503 — This model is currently experiencing high demand` a la vez, y una
   * generación se perdía entera por eso teniendo otros modelos libres. Quien
   * decide si un fallo justifica pasar al siguiente es
   * `shouldTryAnotherModel`, no este archivo.
   *
   * El orden baja en capacidad a propósito: se acepta un Análisis peor antes
   * que ninguno. Cuál contestó de verdad se guarda con el Análisis
   * (`ai_analyses.model`), así que un Análisis flojo siempre se puede explicar
   * — por eso la degradación no es silenciosa.
   *
   * Verificados el 2026-09-04 contra la página de pricing Y contra el free
   * tier de verdad. Las dos comprobaciones son distintas: la página dice qué
   * modelos EXISTEN con free tier, no cuáles lo SIRVEN hoy. La segunda es
   * `npm run ai:live`, y hay que hacerla. Ese día:
   *
   *   · `3.8`, `3.7` y `3.5` → 503, saturados.
   *   · `3.6` → el único Flash que servía. ~40 s por Análisis.
   *   · `gemma-4-31b-it` → sirve, y en 1,4 s: no razona antes de contestar.
   *   · `gemini-2.5-flash` → 404, «no longer available to new users». Fuera.
   *
   * El último es Gemma y no otro Flash a propósito: es el más capaz de los dos
   * Gemma que expone la API (31B denso, contra 26B con 4B activos), no razona
   * —así que es el que más probabilidades tiene de caber en lo que quede del
   * presupuesto— y admite salida estructurada, que es lo único que lo hacía
   * elegible. Un modelo que no sepa devolver un objeto no es un plan B, es un
   * eslabón roto.
   */
  geminiModels: [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemma-4-31b-it",
  ] as const,

  /**
   * El presupuesto de tiempo de UNA generación, cadena entera incluida.
   *
   * Total y no por intento, y es la decisión que hace la cadena viable: cinco
   * modelos a dos minutos cada uno serían diez minutos de peor caso, muy por
   * encima de cualquier `maxDuration` de plataforma. Con un presupuesto
   * compartido, cada intento se lleva lo que queda y el conjunto no puede
   * pasarse de aquí.
   *
   * Dos minutos, y el número sale de medir y no de intuir: tres Análisis
   * reales de los árboles de muestra tardaron ~40 s cada uno (2026-09-04,
   * `gemini-3.6-flash`). Antes decía un minuto, elegido a ojo, y la primera
   * corrida real se lo comió entero. Los que están saturados fallan rápido
   * —entre 300 ms y 6 s— así que la cadena casi nunca cuesta lo que parece.
   *
   * ⚠ Ojo al desplegar, y esto pesa más de lo que parece: si la plataforma
   * corta sus funciones antes de esto, el corte que verá el usuario será el de
   * ella y no éste. La ruta que monte el panel (#16) tiene que declarar un
   * `maxDuration` por encima de este número — y un plan que no llegue a los
   * dos minutos no puede servir esta app tal cual.
   */
  timeoutMs: 120_000,

  /**
   * Lo mínimo que se le deja a un intento para que valga la pena hacerlo.
   *
   * Sin esto, la cadena podía lanzar una petición con 200 ms de presupuesto
   * restante: garantizada a morir por timeout, y contada por Google igual que
   * cualquier otra. Es una llamada de cuota tirada a la basura a cambio de
   * nada. Por debajo de esto se para y se dice que se acabó el tiempo, que es
   * la verdad.
   *
   * Diez segundos porque ni el más rápido de la lista arma un Análisis entero
   * en menos: Gemma tardó 1,4 s en un objeto de dos campos, y un Análisis son
   * un Spec y varios Tickets con sus Checks.
   */
  minAttemptMs: 10_000,

  /**
   * Cuántas veces reintenta el SDK el MISMO modelo. Ninguna.
   *
   * Cero, y es lo que cambió al llegar la cadena: dos mecanismos de reintento
   * anidados son uno de más. Insistirle a un modelo que acaba de decir «high
   * demand» es esperar que el atasco se despeje en 300 ms; pasar al siguiente
   * de la lista es lo que de verdad puede funcionar, y es lo que hace la
   * cadena. Cada reintento del SDK, además, se comía presupuesto que le
   * pertenece al modelo siguiente.
   *
   * El reintento que sí decide algo —volver a pedir el Análisis entero— es del
   * usuario, y para eso está `retryable` en la taxonomía.
   */
  maxRetries: 0,
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

/**
 * Todo el texto del shell del dashboard, en un sitio.
 *
 * Las etiquetas visibles y las de accesibilidad viven juntas por lo mismo que
 * `AUTH_COPY`: «la interfaz es toda en español» es un criterio que no se puede
 * revisar si está repartido por doce componentes.
 */
export const SHELL_COPY = {
  /** La marca cuando la sidebar está plegada y no cabe entera. */
  brandShort: "R(0)",
  /** La etiqueta del destino `/about`, dentro y fuera del shell. */
  about: "Acerca de",
  openMenu: "Abrir el menú de navegación",
  closeMenu: "Cerrar el menú de navegación",
  collapseSidebar: "Plegar la barra lateral",
  expandSidebar: "Desplegar la barra lateral",
  collapse: "Plegar",
  theme: "Tema",
  signOut: "Cerrar sesión",
  /** Lo que lee un lector de pantalla en la fila de cuenta plegada. */
  account: "Tu cuenta",
  /** Bajo «Proyectos» en la sidebar, mientras no haya ninguno. */
  noShortcuts: "Aún no hay Proyectos",
} as const;

/**
 * Todo el texto de la pantalla de Proyectos, en un sitio.
 *
 * Mismo criterio que `AUTH_COPY` y `SHELL_COPY`: «la interfaz es toda en
 * español» es un criterio de aceptación, y un criterio repartido por doce
 * componentes no se puede revisar de una lectura.
 */
export const PROJECTS_COPY = {
  /** El marcador de sección. El boceto lo llama por lo que es, no por su ruta. */
  label: "Tu espacio",
  title: "Proyectos",
  /** En el desplegable de cuenta: la única cuenta que puede entrar es la que confirmó. */
  verified: "Email confirmado",
  signingOut: "Saliendo",

  emptyTitle: "Aún no hay Proyectos.",
  emptyBody: "Tu próximo proyecto empieza con un nodo.",
  /** La llamada a crear. La misma en la cabecera y dentro del recuadro vacío. */
  newProject: "Nuevo proyecto",

  /** Mientras la lista viaja. La silueta ya dice la forma; esto es para quien no la ve. */
  loading: "Cargando tus Proyectos",
  errorTitle: "No se pudieron cargar tus Proyectos.",
  errorBody:
    "Parece que no hay conexión. Lo ya abierto se puede seguir consultando; para editar hace falta red.",
  retry: "Reintentar",

  /** Las acciones de una tarjeta, tras el botón de tres puntos. */
  actions: (title: string) => `Acciones de ${title}`,
  edit: "Editar",
  delete: "Borrar",

  createLabel: "Crear",
  createSubmit: "Crear proyecto",
  creating: "Creando",

  editLabel: "Editar",
  editTitle: "Editar proyecto",
  /** El diálogo de edición no tiene botón de guardar: la app autoguarda. */
  saved: "Guardado — cada cambio se persiste solo",
  saving: "Guardando…",
  done: "Listo",

  titleField: "Título",
  titlePlaceholder: "Tienda online",
  descriptionField: "Descripción — opcional",
  descriptionPlaceholder: "En una línea, de qué va.",
  iconField: "Icono",
  close: "Cerrar",

  deleteTitle: (title: string) => `¿Borrar «${title}»?`,
  /**
   * Lo que se lleva por delante, en cifras y no en abstracto — el mismo
   * criterio que el spec pide al podar un Nodo.
   */
  deleteBody: "No se puede deshacer.",
  deleteCounts: "Se van con él",
  cancel: "Cancelar",
  deleting: "Borrando",

  /**
   * Las tres métricas de la tarjeta. Las dos primeras se doblan en plural;
   * «Análisis» es invariable, así que es un texto y no una función que finge
   * decidir algo.
   */
  versions: (n: number) => (n === 1 ? "Versión" : "Versiones"),
  nodes: (n: number) => (n === 1 ? "Nodo" : "Nodos"),
  analyses: "Análisis",
} as const;

/**
 * Las dos maneras de ver el árbol de una Versión.
 *
 * Es una constante y no dos literales sueltos porque el valor viaja por el
 * estado de la pantalla y por las claves de la copia: un `"canvas"` mal
 * escrito en un sitio dejaría el selector marcando la vista equivocada sin que
 * nada fallara.
 */
export const TREE_VIEWS = {
  registro: "registro",
  canvas: "canvas",
} as const;

export type TreeView = (typeof TREE_VIEWS)[keyof typeof TREE_VIEWS];

/**
 * Todo el texto de la pantalla del árbol, en un sitio.
 *
 * Del ÁRBOL y no de una vista: la cabecera, la barra de acciones y los dos
 * diálogos los comparten la Vista Registro y la Vista Canvas, así que su copia
 * no puede vivir dentro de ninguna de las dos. Lo propio de cada vista está
 * abajo, en `REGISTRO_VIEW_COPY` y `CANVAS_COPY`.
 *
 * Mismo criterio que `AUTH_COPY`, `SHELL_COPY` y `PROJECTS_COPY`: «la interfaz
 * es toda en español» es un criterio de aceptación, y un criterio repartido
 * por doce componentes no se puede revisar de una lectura.
 *
 * Lo que NO está aquí son los mensajes de los rechazos del árbol: viven en
 * `NODE_ERRORS`, junto a la regla del dominio que los provoca, y la pantalla
 * los lee de allí. Copiarlos aquí sería tener la misma frase en dos sitios
 * esperando a que alguien toque uno.
 */
export const TREE_COPY = {
  /**
   * Los dos lados del selector de vista.
   *
   * Sustituyen al marcador de sección que encabezaba la pantalla: donde antes
   * ponía «Registro» ahora hay un interruptor, y la vista activa lleva el
   * punto rojo de 8 px que ya marca lo activo en toda la app.
   */
  views: {
    registro: "Registro",
    canvas: "Canvas",
  },
  /** Lo que lee un lector de pantalla en el grupo del selector. */
  viewSwitch: "Cómo ver el árbol",
  /** La vuelta a la lista, en la cabecera de la pantalla. */
  back: "Proyectos",

  /** El pie del Autoguardado. No hay botón de guardar. */
  saved: "Guardado",
  saving: "Guardando…",
  saveFailed: "No se guardó",

  loading: "Cargando el árbol",
  errorTitle: "No se pudo cargar el árbol.",
  errorBody:
    "Parece que no hay conexión. Lo ya abierto se puede seguir consultando; para editar hace falta red.",
  retry: "Reintentar",

  emptyTitle: "Esta Versión aún no tiene Nodos.",
  emptyBody: "Empieza por una idea suelta. Después le cuelgas las partes.",
  firstNode: "Primer Nodo",
  /** La llamada al pie de la lista, y la de la cabecera en escritorio. */
  newRoot: "Nodo raíz",

  /** Dentro de un Nodo recién creado, mientras no tenga texto. */
  nodePlaceholder: "Escribe tu idea…",
  /**
   * Cómo se cita un Nodo dentro de una frase: entrecomillado, o por lo que es
   * si todavía no tiene texto.
   *
   * Es una función y no dos textos sueltos porque la decisión —¿comillas
   * españolas?, ¿qué se dice de uno vacío?— la toman cuatro sitios (la fila, la
   * barra y los dos diálogos), y cuatro copias de una decisión de copy se
   * desincronizan en cuanto alguien toca una.
   */
  nodeLabel: (content: string) =>
    content.trim() ? `«${content.trim()}»` : "este Nodo",
  /** Cuántas bajas quedan sin enumerar en la confirmación de borrado. */
  andMore: (n: number) => `y ${n} más`,
  /**
   * Cuando una operación se para porque lo tecleado no llegó a guardarse.
   *
   * Se para a propósito: mover un Nodo cuyo texto no se persistió acabaría
   * enseñando «Guardado» sobre una idea perdida.
   */
  blockedByText:
    "No se pudo guardar lo que escribiste, así que no se hizo el cambio. Revisa la conexión.",


  /** La Versión abierta: su etiqueta si la tiene, si no su número. */
  versionName: (versionNumber: number, label: string | null) =>
    label ?? `Versión ${versionNumber}`,
  versionChip: (versionNumber: number) => `v${versionNumber}`,
  nodeCount: (n: number) => `${n} ${n === 1 ? "Nodo" : "Nodos"}`,
  subnodeCount: (n: number) => `${n} ${n === 1 ? "subnodo" : "subnodos"}`,

  /** Lo que lee un lector de pantalla en cada fila y en el campo. */
  select: (text: string) => `Seleccionar ${text}`,
  edit: (text: string) => `Editar el texto de ${text}`,
  /**
   * Lo que dice el botón de cerrar la barra a quien no ve la palabra «Quitar».
   *
   * Se llama `deselectHint` y no `deselect` porque `actions.deselect` ya existe
   * y es la etiqueta VISIBLE: dos claves llamadas igual en el mismo objeto se
   * confunden justo cuando alguien va a cambiar una de las dos.
   */
  deselectHint: "Quitar la selección",

  /** La barra de acciones del Nodo seleccionado. */
  actions: {
    up: "Subir",
    down: "Bajar",
    child: "Subnodo",
    sibling: "Hermano",
    move: "Mover a…",
    remove: "Borrar",
    /**
     * Cierra la barra sin tocar el árbol.
     *
     * Está entre las acciones y no en una cabecera propia porque la barra ya no
     * tiene cabecera: enseñaba el texto del Nodo y se quitó. Desde el dedo esto
     * es un botón más de la misma fila, así que aquí vive.
     */
    deselect: "Quitar",
  },

  moveLabel: "Mover",
  moveLead: "Elige su nuevo padre. Se colocará el último de sus hermanos nuevos.",
  moveRoot: "Sin padre — dejarlo como raíz",
  /**
   * Por qué un destino no vale, a la derecha de su fila.
   *
   * Los destinos bloqueados SE ENSEÑAN, no se filtran: quitarlos de la lista
   * dejaría al usuario buscando un Nodo que desapareció sin explicación, que
   * es peor que un «no puedes» dicho a la cara. Ver `reparentTargets`.
   */
  moveBlockedSelf: "es el propio Nodo",
  moveBlockedDescendant: "es un subnodo suyo",
  moveBlockedGone: "ya no está aquí",
  moveCurrent: "es su padre actual",
  moveSubmit: "Mover aquí",

  deleteLabel: "Borrar",
  deleteTitle: (text: string) => `¿Borrar ${text}?`,
  deleteBody: "Se lleva su subárbol entero. No se puede deshacer.",
  /** El pie de la cifra grande de la confirmación. */
  deleteFalls: (n: number) =>
    n === 1 ? "subnodo cae con él" : "subnodos caen con él",
  deleteSubmit: "Borrar",

  cancel: "Cancelar",
  close: "Cerrar",

  /** El nombre de la pantalla en la pestaña del navegador. */
  screenTitle: "Árbol",
} as const;

/**
 * Lo que solo dice la Vista Canvas.
 *
 * Separado de `TREE_COPY` a propósito: lo de arriba lo comparten las dos
 * vistas, y esto es de una sola. El día que alguien busque «¿de dónde sale
 * “Ajustar”?» tiene que encontrarlo aquí y no entre la copia de los diálogos.
 */
export const CANVAS_COPY = {
  /** Mientras se coloca el árbol. La silueta ya dice la forma; esto es para quien no la ve. */
  loading: "Colocando el árbol",
  /** Lo que lee un lector de pantalla en el lienzo entero. */
  canvasLabel: "El árbol como diagrama",

  zoomIn: "Acercar",
  zoomOut: "Alejar",
  /** Encajar el bosque entero. NO es lo mismo que la pantalla completa. */
  fit: "Encajar el árbol",
  fullscreen: "Pantalla completa",
  exitFullscreen: "Salir de pantalla completa",

  /**
   * La marca de que aquí no se edita.
   *
   * Solo aparece por debajo de `lg`, que es donde la barra de acciones no se
   * monta: sin ella, un Nodo resaltado y ningún botón parecería un fallo.
   */
  readOnly: "Solo consulta",
  readOnlyHint: "En el móvil el Canvas es solo para consultar. Cambia a Registro para editar.",
  /** Cuando la Versión está vacía y no hay ni un Nodo que dibujar. */
  emptyOnMobile: "Cambia a Registro para escribir el primero.",

  /** El «+» que sale al pasar por encima de un Nodo. */
  addChild: (text: string) => `Crear un subnodo de ${text}`,

  /**
   * Cómo se abre el campo de un Nodo en el lienzo: con dos clics.
   *
   * Dos y no uno sobre el ya seleccionado —que es lo que hace la Vista
   * Registro— porque aquí el cuerpo del Nodo ES el asa del arrastre: un
   * arrastre que empieza y acaba encima del mismo Nodo dispara `click` en
   * todos los navegadores, y con la regla del Registro cada arrastre
   * cancelado abriría el teclado.
   */
  editHint: "Doble clic para escribir",

  /**
   * Y aquí NO está el «aquí no» del arrastre. El aviso que flota mientras se
   * arrastra sobre un destino inválido dice la frase de `NODE_ERRORS`, que es
   * la MISMA que lanzaría el servicio si se intentara de verdad. Escribir una
   * segunda versión aquí sería tener dos formas de decir el mismo rechazo
   * esperando a que alguien toque una.
   */
} as const;

/**
 * Todo el texto del Panel de IA, en un sitio.
 *
 * Aparte de `TREE_COPY` por lo mismo que `VERSIONS_COPY`: lo de allí es del
 * árbol y sus dos vistas, y esto es de una capa que se abre encima y habla de
 * otra cosa. El día que alguien busque «¿de dónde sale “los marca el agente”?»
 * tiene que encontrarlo aquí y no entre la copia de las filas de Nodos.
 *
 * Lo que NO está aquí son los mensajes de los FALLOS. Esos los escriben las
 * clases de `lib/ai/errors.ts` y viajan dentro de `AnalysisFailure.message`, ya
 * en español y ya listos para enseñar. Copiarlos aquí sería tener el mismo «se
 * agotó la cuota» en dos sitios esperando a que alguien toque uno. Lo que sí
 * está es el TITULAR de cada categoría, que es cosa de la pantalla: el mensaje
 * dice qué pasó y el titular lo dice en el idioma de quien lo lee.
 *
 * Tampoco está el rechazo de la Versión vacía: lo escribe `ANALYSIS_ERRORS` en
 * `lib/services/analyses.ts`, junto al límite que lo provoca.
 */
export const ANALYSIS_COPY = {
  /** El marcador de sección de la hoja, y su etiqueta accesible. */
  label: "Análisis",

  /**
   * Los tres estados de la puerta. Ver `doorState` en `components/analysis`.
   *
   * «Análisis listo» y no «Ver Análisis» porque cuando aparece, la persona
   * estaba escribiendo en el árbol: lo que necesita saber es que llegó, no qué
   * hacer con ello.
   */
  door: {
    analizar: "Analizar",
    generando: "Generando",
    listo: "Análisis listo",
  },
  openPanel: "Abrir el Panel de IA",
  closePanel: "Cerrar el Panel de IA",

  /* ── Antes de generar ─────────────────────────────────────────────────── */

  emptyTitle: "Analizar esta Versión",
  /** Bajo el título, mientras no haya ningún Análisis guardado. */
  emptyMeta: (nodes: number) =>
    `${nodes} ${nodes === 1 ? "Nodo" : "Nodos"} · todavía sin analizar`,

  guidelinesField: "Directrices — opcional",
  /**
   * El marcador de posición ENSEÑA para qué sirven las Directrices.
   *
   * Un ejemplo y no «escribe aquí…»: la Intención no se elige en la UI (ADR
   * 0003), así que este campo es la única palanca para corregirla, y una
   * persona que no lo sepa no la usará nunca. El ejemplo es justo el caso que
   * el ADR pone: desmentir un «proyecto nuevo».
   */
  guidelinesPlaceholder:
    "Es un arreglo sobre algo ya desplegado, no un proyecto nuevo.",
  guidelinesHint:
    "Van con prioridad máxima por delante del árbol. Son también la única forma de corregir la Intención.",
  /** Mientras la petición está en vuelo: lo escrito ya salió, tocarlo no la alcanza. */
  guidelinesSent: "Directrices — enviadas",
  guidelinesCount: (used: number, max: number) =>
    `${used.toLocaleString("es")} / ${max.toLocaleString("es")}`,

  generate: "Generar",
  generating: "Generando…",
  /** El botón durante la espera que impuso el proveedor. Ver `retryPlan`. */
  retryIn: (seconds: number) => `Reintentar en ${seconds} s`,
  retry: "Reintentar",
  regenerate: "Regenerar",

  /**
   * Lo que se promete al pulsar. Los dos datos que la gente pregunta: cuánto
   * tarda y si puede irse.
   *
   * Los 40 s no son un adorno: es lo que midieron tres Análisis reales el
   * 2026-09-04 (ver `AI_CONFIG.timeoutMs`).
   */
  generateHint: "Suele tardar unos 40 s. Puedes cerrar esta hoja y seguir editando el árbol.",
  generatingTitle: "Generando…",
  generatingMeta: (nodes: number) =>
    `Leyendo tus ${nodes} ${nodes === 1 ? "Nodo" : "Nodos"}. Unos 40 s.`,
  generatingHint:
    "Cierra la hoja si quieres: el árbol se sigue editando y el Análisis llega igual.",

  /* ── Leer el último Análisis guardado ─────────────────────────────────── */

  loading: "Cargando el Análisis",
  loadErrorTitle: "No se pudo cargar el Análisis.",
  loadErrorBody:
    "Parece que no hay conexión. Puedes seguir editando el árbol y volver a intentarlo.",

  /**
   * QUÉ modelo lo escribió. No cuándo: la fecha es material del historial (#17).
   *
   * Se enseña porque el adaptador tiene cadena de reserva y el ADR 0003 pide
   * que degradar no sea silencioso: un Análisis flojo se explica sabiendo que
   * lo sirvió un plan B. Por eso existe `ai_analyses.model`.
   */
  provenance: (model: string) => `Escrito por ${model}`,

  /* ── El Análisis ──────────────────────────────────────────────────────── */

  intentLabel: "Intención deducida",
  /**
   * Cómo se lee cada Intención. Las claves son el enum cerrado del schema.
   *
   * En mayúsculas porque se pintan en NDot a 40 px: es la única palabra del
   * panel que tiene que leerse de un vistazo, y la NDot es la display de la
   * app. Un `Record` completo y no una función con `default`: si mañana nace
   * una Intención nueva en el schema, esto deja de compilar, que es justo lo
   * que hay que enterarse.
   */
  intents: {
    "proyecto-nuevo": "PROYECTO NUEVO",
    feature: "FEATURE",
    fix: "FIX",
    refactor: "REFACTOR",
    ui: "UI",
    infra: "INFRA",
    docs: "DOCS",
    otro: "OTRO",
  } as const,
  /**
   * La salida cuando la IA se equivocó de Intención.
   *
   * Va DENTRO del bloque de la Intención a propósito: es lo que el ADR 0003
   * pide que el panel empuje. Sin ella, la única palanca de corrección queda
   * plegada en el pie sin que nada diga que es ahí donde se arregla.
   */
  intentWrong: "¿No es eso?",
  intentFix: "Corregir con Directrices",

  summary: "Resumen",

  questions: "Preguntas de clarificación",
  /** Las preguntas no se contestan en el panel: es alcance de v1 del spec. */
  questionsReadOnly: "Solo lectura",
  questionsHint:
    "Aquí no se contestan. «Al árbol» crea el Nodo con la pregunta; la respuesta la escribes tú y vuelves a generar.",
  /**
   * Lleva una pregunta al único sitio donde se puede contestar.
   *
   * No responde nada en la interfaz —eso sigue fuera de alcance—: crea un Nodo
   * raíz con la pregunta dentro y abre el campo debajo. Es el atajo del paso
   * que la historia 40 ya manda dar a mano.
   */
  questionToTree: "Al árbol",
  questionToTreeHint: (question: string) =>
    `Crear un Nodo en el árbol con la pregunta: ${question}`,

  spec: "Spec",
  specProblem: "Problema",
  specSolution: "Solución",
  specDecisions: "Decisiones de implementación",
  specTesting: "Decisiones de testing",
  specOutOfScope: "Fuera de alcance",

  checks: "Checks",
  /**
   * Por qué las casillas están apagadas.
   *
   * Sin esta línea, una casilla deshabilitada parece un fallo. Los Checks son
   * la prueba que tiene que cumplir el agente al que se le pegue el Master
   * Prompt, no un TODO list de la app — y el Análisis, además, es histórico y
   * no se edita nunca (`ports/entities.ts`).
   */
  checksWhy: "los marca el agente",

  tickets: "Tickets",
  /**
   * Cuántos son, y nada más.
   *
   * Decía «en orden de bloqueo» y era una promesa que nadie sostiene: el schema
   * comprueba que los `blockedBy` existan y no formen ciclos, no que los
   * Tickets vengan ordenados topológicamente. La copia afirmaba una garantía
   * del modelo que el modelo no da.
   */
  ticketCount: (n: number) => `${n} en total`,
  blockedBy: "Bloqueado por",
  /** Un bloqueo se nombra por su título, no por su id: el id no dice nada. */
  blocker: (id: string, title: string) => `${id} · ${title}`,

  /* ── Cuando algo falla ────────────────────────────────────────────────── */

  /**
   * El titular de cada categoría de fallo.
   *
   * El CUERPO lo escribe la clase que falló y viaja en `failure.message`; esto
   * es solo el titular, que es cosa de la pantalla. El de `cuota` es literal
   * del criterio de aceptación: «límite de la API gratuita alcanzado».
   *
   * `Record` completo sobre `AnalysisErrorKind`: una categoría nueva en la
   * taxonomía rompe la compilación aquí en vez de salir sin titular.
   */
  failures: {
    cuota: "Límite de la API gratuita alcanzado",
    timeout: "La IA tardó demasiado",
    red: "No se pudo contactar con la IA",
    malformada: "La IA devolvió algo que no es un Análisis",
    configuracion: "Falta configuración del Proveedor de IA",
    sesion: "Hay que entrar para generar",
    entrada: "Esto no se puede analizar",
  } as const,
  /**
   * Lo que se promete al que acaba de ver fallar una generación.
   *
   * Las dos mitades importan: no se ha gastado nada de su árbol (nada se
   * persiste si no valida, ADR 0003) y lo que escribió sigue escrito, que es
   * un criterio de aceptación literal del ticket.
   */
  failureKept: "No se ha gastado nada de tu árbol. Tus Directrices siguen escritas.",
  quotaHint:
    "El free tier de Gemini se reparte por minuto. La espera la dice el propio proveedor.",
  dismiss: "Descartar el aviso",
  /** Cuando no hay sesión, lo que hace falta no es un botón sino ir a entrar. */
  goToLogin: "Entrar",
} as const;

/**
 * Todo el texto de la gestión de Versiones, en un sitio.
 *
 * Aparte de `TREE_COPY` aunque el selector viva en su cabecera, y por la misma
 * razón por la que `CANVAS_COPY` está aparte: lo de allí lo comparten las dos
 * vistas del árbol, y esto es de un control y tres diálogos que hablan de otra
 * cosa. El día que alguien busque «¿de dónde sale “sin merge”?» tiene que
 * encontrarlo aquí y no entre la copia de las filas de Nodos.
 *
 * Lo que NO está aquí es el rechazo de la última Versión: esa frase la escribe
 * el puerto (`adapters/postgrest/kernel.ts`), que es quien aplica la regla, y
 * la pantalla la lee de allí. Dos versiones del mismo «no puedes» acabarían
 * diciendo cosas distintas.
 */
export const VERSIONS_COPY = {
  /** El marcador de sección del desplegable, y su etiqueta accesible. */
  label: "Versiones",
  /** Lo que lee un lector de pantalla en el disparador. */
  open: "Cambiar de Versión",
  /** Las acciones de una fila, tras el botón de tres puntos. */
  actions: (name: string) => `Acciones de ${name}`,

  clone: "Clonar",
  rename: "Renombrar",
  delete: "Borrar",
  /** La llamada al pie del desplegable: clona la Versión que estás editando. */
  cloneCurrent: "Clonar esta Versión",

  /**
   * De dónde salió una Versión, bajo su nombre.
   *
   * Solo se dice cuando se SABE. `sourceVersionId` a nulo significa dos cosas
   * —nació original, o su origen se borró (`on delete set null`)—, y llamar
   * «original» a la segunda sería inventarse una procedencia. Callar es la
   * única de las dos opciones que nunca miente.
   */
  clonedFrom: (versionNumber: number) => `clonada de v${versionNumber}`,

  /** Mientras la lista viaja. */
  loading: "Cargando las Versiones",
  errorTitle: "No se pudieron cargar las Versiones.",

  /**
   * Cuando la Versión que pide la URL no está entre las del Proyecto.
   *
   * No dice «no es tuya» ni «no existe» por separado, y es deliberado: bajo
   * RLS las dos son el mismo resultado —cero filas— y distinguirlas le
   * confirmaría a quien va probando ids que uno de ellos existe. Ver
   * `lib/backend/ports/errors.ts`.
   */
  goneTitle: "Esa Versión no está aquí.",
  gone: "Puede que la borraras, o que la dirección esté mal escrita. Estas son las Versiones del Proyecto.",
  /** Cuando además el Proyecto entero se quedó sin nada que ofrecer. */
  goneEmpty: "Puede que la borraras, o que la dirección esté mal escrita.",
  backToProjects: "Volver a Proyectos",

  /** El campo de la etiqueta, en el diálogo de clonar y al renombrar. */
  labelField: "Etiqueta — opcional",
  labelPlaceholder: "Rumbo B",
  /** Al renombrar no hay botón de guardar: la app autoguarda. */
  renameHint: "Se guarda solo",

  cloneTitle: (versionNumber: number) => `Clonar la Versión ${versionNumber}`,
  /**
   * Lo que de verdad hace clonar, dicho entero.
   *
   * «Independiente» y «no hay forma de volver a unirlas» no son adorno: «sin
   * merge, nunca» es una decisión del proyecto (`CONTEXT.md`), y una persona
   * que venga de git da por hecho lo contrario si nadie se lo dice.
   */
  cloneBody:
    "Se copia el árbol entero en una Versión nueva e independiente. Editar el clon no toca ésta, y no hay forma de volver a unirlas.",
  cloneNodes: (n: number) => `${n} ${n === 1 ? "Nodo" : "Nodos"}`,
  /** El puerto no copia Análisis, así que el diálogo no lo insinúa. */
  cloneAnalyses: "Los Análisis no se copian: pertenecen a la Versión que los generó.",
  cloneSubmit: "Clonar",
  cloning: "Clonando",

  deleteTitle: (name: string) => `¿Borrar «${name}»?`,
  /** El pie de la cifra grande, como al podar un Nodo. Ver `TREE_COPY.deleteFalls`. */
  deleteFalls: (n: number) => (n === 1 ? "Nodo cae con ella" : "Nodos caen con ella"),
  /** Al lado de la cifra: qué es exactamente lo que se lleva por delante. */
  deleteSubtree: "Se va el árbol entero de esta Versión, y sus Análisis con él.",
  deleteBody: "No se puede deshacer.",
  /** Lo que NO se lleva por delante: el clon ya es independiente. */
  deleteKeepsClones: "Las Versiones clonadas de ésta no se tocan.",
  deleteSubmit: "Borrar",
  deleting: "Borrando",

  cancel: "Cancelar",
  close: "Cerrar",
} as const;

/**
 * El texto de la PWA: la pantalla que sale sin red y el aviso que la anuncia.
 *
 * Junto y en un sitio por lo mismo que `AUTH_COPY` y `SHELL_COPY`. Y con más
 * razón aquí: es el único texto de la app que el usuario lee justo cuando nada
 * funciona, así que tiene que decir qué SÍ se puede hacer y no solo qué falló.
 */
export const PWA_COPY = {
  /**
   * «Sin conexión», la etiqueta corta del estado.
   *
   * La comparten los tres sitios que nombran ese estado sin adornos: el título
   * del aviso del layout, el `<title>` de `/offline` y su versalita. No se
   * llama `bannerTitle` porque no es del banner: el `h1` de la pantalla es
   * `offlineTitle`, en mayúsculas y NDot, y son dos cosas distintas.
   */
  offlineLabel: "Sin conexión",

  /** El titular de `/offline`, en NDot como el resto de los `h1`. */
  offlineTitle: "SIN CONEXIÓN",
  offlineLead: "Esta pantalla no estaba guardada, y sin red no se puede pedir.",
  offlineBody:
    "RICE(0) guarda lo que vas visitando para que puedas volver a leerlo sin conexión. Lo que todavía no abriste con red no está aquí — no se perdió, solo hace falta conexión para traerlo la primera vez.",
  /** Encabeza la lista de lo que sí se puede hacer ahora mismo. */
  offlineAvailable: "Mientras vuelve la red",
  offlineCanRead: "Los Proyectos y Versiones que ya abriste se leen igual.",
  offlineCannotEdit:
    "Crear y editar quedan bloqueados: el Autoguardado no puede escribir sin red.",
  offlineWillRetry:
    "No hace falta reintentar a mano. Cuando vuelva la conexión, la app sigue por donde iba.",
  /** El botón, para quien no quiere esperar. */
  offlineRetry: "Reintentar",
  /** El destino de vuelta, que puede estar en caché. */
  offlineBack: "Ir a mis Proyectos",
} as const;

/**
 * El texto del bloqueo de edición sin conexión.
 *
 * Aparte de `PWA_COPY` aunque las dos hablen de estar sin red, y la frontera
 * es de qué hablan: allí es la CONSULTA —qué se puede seguir leyendo, y la
 * pantalla que sale cuando algo no estaba guardado—; aquí es la EDICIÓN —que
 * está prohibida, y que se reactiva sola—. Son dos mitades del mismo estado
 * escritas por dos tickets (#18 y #19), y juntarlas en un objeto obligaría a
 * leer los comentarios para saber cuál de las dos cosas dice cada clave.
 *
 * Mismo criterio que `AUTH_COPY` y compañía: «la interfaz es toda en español»
 * es un criterio de aceptación, y repartido por doce componentes no se puede
 * revisar de una lectura.
 */
export const CONNECTION_COPY = {
  /** La versalita del banner. La misma palabra que `/offline` en su `h1`. */
  offline: PWA_COPY.offlineLabel,
  /**
   * La frase del banner, en el orden en que importa: primero lo que NO se
   * puede, porque es lo que explica que los botones no respondan, y después lo
   * que SÍ, para que nadie crea que la app se cayó entera.
   */
  offlineBody:
    "No puedes editar hasta reconectar. Lo ya abierto se puede seguir consultando.",
  /**
   * Que se está reintentando solo.
   *
   * Va sin botón al lado a propósito: quien reintenta es el sondeo de Next,
   * cada 3 s como mucho, y un botón sería ofrecer un gesto que no cambia nada
   * —lo pulses o no, la próxima comprobación ya venía—. Es al revés que el
   * «Reintentar» de un Análisis fallido, que sí decide algo.
   */
  retrying: "Reintentando",

  /** La vuelta, mientras el aviso se apaga solo. */
  back: "De vuelta",
  backBody: "Ya puedes editar.",

  /**
   * El cuarto estado del pie del Autoguardado.
   *
   * Existe porque sin él ese pie mentiría exactamente en el instante en que no
   * puede permitírselo: lo tecleado justo antes del corte no está guardado
   * («Guardado» sería falso) y tampoco está saliendo hacia ningún sitio
   * («Guardando…» también). Está esperando a que vuelva la red, y se escribirá
   * solo cuando vuelva.
   */
  savePending: "Pendiente",
  /**
   * El motivo de un control apagado, al pasar por encima.
   *
   * Va en `title`, así que es una pista de RATÓN y no de lector de pantalla —
   * un `title` sobre un botón deshabilitado no se anuncia—. Quien no ve la
   * pantalla se entera por la franja, que es un `role="status"` y sí se lee
   * sola en cuanto sale. Duplicarlo en un `aria-describedby` por botón sería
   * hacer que la misma frase se leyera veinte veces.
   */
  blocked: "Sin conexión: no puedes editar hasta reconectar.",
} as const;
