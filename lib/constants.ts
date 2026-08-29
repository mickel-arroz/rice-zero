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
