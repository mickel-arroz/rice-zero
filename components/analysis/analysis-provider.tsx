"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { doorState, type DoorState } from "@/components/analysis/panel";
import { generateAnalysis } from "@/app/(dashboard)/projects/[projectId]/[versionId]/actions";
import { describeAnalysisFailure, type AnalysisFailure } from "@/lib/ai";
import type { Analysis } from "@/lib/backend/ports";
import { errorMessage } from "@/lib/errors";
import { analysisService } from "@/lib/services/analyses";

/**
 * El Análisis de la Versión abierta, y todo lo que se puede pedirle a la IA.
 *
 * ── Por qué está SEPARADO del árbol ───────────────────────────────────────
 *
 * «Mientras la IA genera, el lienzo y toda la edición siguen 100% operativos
 * (estado de IA independiente)» es la historia 43 del spec y un criterio de
 * aceptación de este ticket. Eso NO se cumple con código que sincronice dos
 * estados: se cumple por DÓNDE se monta esto. La página monta este provider
 * FUERA de `TreeProvider`, así que una generación de cuarenta segundos y una
 * escritura de un Nodo no comparten ni un `setState`. No hay forma de que la
 * primera bloquee a la segunda porque no se tocan.
 *
 * Y por eso mismo cerrar la hoja no cancela nada: la hoja es un componente que
 * se desmonta, y esto vive por encima de ella. Lo que estaba en vuelo aterriza
 * igual, y quien lo cuenta cuando la hoja no está es la puerta (`doorState`).
 *
 * Es de cliente por lo mismo que `TreeProvider` (ADR 0001): el navegador habla
 * directo con PostgREST bajo RLS, así que el Análisis se GUARDA desde aquí. Lo
 * único que corre en el servidor es la llamada al modelo, porque la API key no
 * sale de allí — y llega como el Server Action que se le inyecta al servicio.
 *
 * ── Qué NO hace ───────────────────────────────────────────────────────────
 *
 * No lee el árbol. Podría —está montado al lado— y sería un error: el servicio
 * ya lo lee él mismo desde el motor, que es la única fuente que puede prometer
 * que lo analizado es lo GUARDADO y no un borrador a medio escribir en la
 * pantalla. Si el provider le pasara sus Nodos, un texto en pleno rebote de
 * Autoguardado entraría en el prompt sin estar persistido.
 */

type Status =
  /** No se ha abierto nunca, o la Versión no tiene Análisis. */
  | "idle"
  /** Leyendo del motor el último Análisis guardado. Rápido. */
  | "loading"
  /** La IA está trabajando. Unos cuarenta segundos. */
  | "generating"
  /** Hay un Análisis que enseñar. */
  | "ready"
  /** No se pudo LEER. Los fallos de generar no son esto: ver `failure`. */
  | "error";

type AnalysisState = {
  status: Status;
  /**
   * El Análisis que se enseña. Es ortogonal a `status` a propósito: mientras
   * se regenera, y también si la regeneración falla, lo que había sigue en
   * pantalla. Vaciarlo castigaría un reintento con la pérdida de lo anterior.
   */
  analysis: Analysis | null;
  /** El fallo de LECTURA, ya en español. */
  loadError: string | null;
  /**
   * El fallo de GENERACIÓN, en la forma que cruzó el Server Action.
   *
   * Aparte de `status` porque no son la misma pregunta: «¿hay algo que
   * enseñar?» y «¿salió mal el último intento?» tienen respuestas
   * independientes, y meterlas en un solo enum obligaría a estados como
   * «listo-pero-falló» que nadie sabría pintar.
   */
  failure: AnalysisFailure | null;
  /** Cuándo falló, en epoch ms. Lo consume la cuenta atrás de la cuota. */
  failedAt: number | null;
};

type AnalysisContextValue = AnalysisState & {
  /** Directrices del Usuario. Se conservan pase lo que pase: ver `generate`. */
  guidelines: string;
  /**
   * ¿Está el campo de Directrices desplegado?
   *
   * Vive aquí y no en el pie que lo pinta porque quien pide desplegarlo está
   * en otra rama del árbol: «Corregir con Directrices», arriba del Análisis.
   * Con el estado dentro del pie, ese enlace no tenía forma de abrirlo — era
   * un ancla a un elemento que ya estaba visible y plegado, así que pulsarlo
   * no hacía absolutamente nada.
   */
  guidelinesOpen: boolean;
  /**
   * Cuántas veces se ha pedido escribir Directrices. Un contador y no un
   * booleano: el pie enfoca el campo cada vez que cambia, y con un booleano
   * el segundo «Corregir» seguido no movería el foco.
   */
  guidelinesFocus: number;
  /** ¿Está la hoja delante? */
  open: boolean;
  /** Qué dice la puerta de la cabecera. */
  door: DoorState;

  setGuidelines(value: string): void;
  /** Despliega el campo de Directrices y pide el foco. Lo llama «Corregir». */
  askForGuidelines(): void;
  /** Lo pliega o lo despliega a mano, desde el propio pie. */
  toggleGuidelines(): void;
  openPanel(): void;
  closePanel(): void;
  /** Vuelve a leer el último Análisis guardado. Para el estado de error. */
  reload(): Promise<void>;
  generate(): Promise<void>;
  /** Quita el aviso flotante. No borra nada más. */
  dismissFailure(): void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

/**
 * Solo «¿está el panel delante?», y nada más.
 *
 * Un segundo contexto para UN booleano, y no es ceremonia: quien lo consume es
 * `TreeScreen`, para apartarse y hacerle sitio al panel acoplado. Con el
 * contexto grande, `TreeScreen` se suscribía también a `guidelines` — así que
 * CADA TECLA escrita en las Directrices repintaba la pantalla del árbol entera,
 * el Registro y el Canvas incluidos.
 *
 * Es exactamente el bloqueo que este ticket promete no tener, colándose por la
 * puerta de atrás: el aislamiento que el provider consigue por dónde está
 * montado se perdía por una suscripción de más. Un booleano solo cambia de
 * identidad cuando cambia de valor, así que ahora el árbol se entera de abrir y
 * cerrar, y de nada más.
 */
const AnalysisOpenContext = createContext(false);

export function AnalysisProvider({
  versionId,
  children,
}: {
  versionId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    analysis: null,
    loadError: null,
    failure: null,
    failedAt: null,
  });
  const [guidelines, setGuidelines] = useState("");
  // Desplegado mientras no haya nada que leer: en una Versión sin analizar, lo
  // único que se puede hacer en el panel es escribir aquí y generar.
  const [guidelinesOpen, setGuidelinesOpen] = useState(true);
  const [guidelinesFocus, setGuidelinesFocus] = useState(0);
  const [open, setOpen] = useState(false);
  /** Llegó un Análisis con la hoja cerrada y nadie lo ha abierto todavía. */
  const [unread, setUnread] = useState(false);

  /**
   * El último Análisis se lee la PRIMERA vez que se abre la hoja, no al montar.
   *
   * La mayoría de las veces que se abre la pantalla de un árbol es para
   * escribir en él, no para analizarlo, y una lectura al montar sería un viaje
   * al motor en todas ellas para no enseñar nada. Mismo criterio que
   * `VersionGate`: solo se lee lo que se PINTA.
   */
  const loaded = useRef(false);
  /** Una lectura tardía no puede pisar a la siguiente. Igual que en el árbol. */
  const loadTicket = useRef(0);
  /** ¿Hay una generación en vuelo? Impide lanzar dos a la vez. */
  const generating = useRef(false);

  // El servicio se arma UNA vez: `analysisService` no memoiza, y construirlo en
  // cada llamada creaba dos objetos para hablar con el mismo motor.
  const service = useMemo(() => analysisService(generateAnalysis), []);

  const fetchLatest = useCallback(async () => {
    const ticket = ++loadTicket.current;
    setState((prev) => ({ ...prev, status: "loading", loadError: null }));

    try {
      const analyses = await service.list(versionId);
      if (ticket !== loadTicket.current) return;
      loaded.current = true;

      // La lista viene del más nuevo al más viejo, así que el primero es el
      // vigente. El HISTORIAL entero es alcance de #17; aquí solo hace falta
      // saber si esta Versión ya tiene un Análisis que enseñar.
      const latest = analyses[0] ?? null;
      setState((prev) => ({
        ...prev,
        status: latest ? "ready" : "idle",
        analysis: latest,
        loadError: null,
      }));
      // Con Análisis delante, lo que manda es el Análisis: el campo entero
      // empujaría la Intención fuera de la vista, y la Intención es
      // exactamente lo que hay que leer primero.
      if (latest) setGuidelinesOpen(false);
    } catch (error) {
      if (ticket !== loadTicket.current) return;
      setState((prev) => ({
        ...prev,
        status: "error",
        loadError: errorMessage(error),
      }));
    }
  }, [versionId, service]);

  const openPanel = useCallback(() => {
    setOpen(true);
    // Abrirla ES leerlo: la puerta deja de anunciarlo en cuanto está delante.
    setUnread(false);
    // Nunca mientras genera: la lectura devolvería el Análisis ANTERIOR y lo
    // pintaría encima de la silueta de la generación en curso.
    if (!loaded.current && !generating.current) void fetchLatest();
  }, [fetchLatest]);

  const closePanel = useCallback(() => setOpen(false), []);

  const reload = useCallback(async () => {
    await fetchLatest();
  }, [fetchLatest]);

  const generate = useCallback(async () => {
    // Dos generaciones a la vez son dos peticiones del free tier para que solo
    // una se guarde. El botón ya está deshabilitado; esto es la red de abajo.
    if (generating.current) return;
    generating.current = true;

    setState((prev) => ({
      ...prev,
      status: "generating",
      // El fallo anterior se va al empezar: lo que estaba contando la cuenta
      // atrás ya no describe lo que está pasando.
      failure: null,
      failedAt: null,
    }));

    try {
      const analysis = await service.generate({
        versionId,
        guidelines,
      });
      loaded.current = true;
      setState((prev) => ({
        ...prev,
        status: "ready",
        analysis,
        loadError: null,
      }));
      setGuidelinesOpen(false);
      // Si llegó con la hoja cerrada, la puerta se enciende. Un cartel encima
      // interrumpiría justo lo que este ticket promete no interrumpir.
      setUnread((wasUnread) => (open ? wasUnread : true));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        // Se vuelve a lo que había, que puede ser un Análisis viejo o nada.
        // Fallar no borra el anterior.
        status: prev.analysis ? "ready" : "idle",
        failure: describeAnalysisFailure(error),
        failedAt: Date.now(),
      }));
      // Las Directrices NO se tocan, y es un criterio de aceptación literal:
      // «reintento sin perder Directrices». No hay código que las borre porque
      // no debe haberlo — quien lo añada, romperá el criterio.
    } finally {
      generating.current = false;
    }
  }, [versionId, guidelines, open, service]);

  const askForGuidelines = useCallback(() => {
    setGuidelinesOpen(true);
    setGuidelinesFocus((n) => n + 1);
  }, []);

  const toggleGuidelines = useCallback(() => setGuidelinesOpen((v) => !v), []);

  const dismissFailure = useCallback(() => {
    setState((prev) => ({ ...prev, failure: null, failedAt: null }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      guidelines,
      guidelinesOpen,
      guidelinesFocus,
      open,
      door: doorState({ generating: state.status === "generating", unread }),
      setGuidelines,
      askForGuidelines,
      toggleGuidelines,
      openPanel,
      closePanel,
      reload,
      generate,
      dismissFailure,
    }),
    [
      state,
      guidelines,
      guidelinesOpen,
      guidelinesFocus,
      open,
      unread,
      askForGuidelines,
      toggleGuidelines,
      openPanel,
      closePanel,
      reload,
      generate,
      dismissFailure,
    ],
  );

  return (
    <AnalysisContext.Provider value={value}>
      <AnalysisOpenContext.Provider value={open}>
        {children}
      </AnalysisOpenContext.Provider>
    </AnalysisContext.Provider>
  );
}

/**
 * El Análisis de la Versión abierta.
 *
 * @throws si se usa fuera de la pantalla, igual que `useTree`: un panel de IA
 * sin Versión no tiene estado degradado sensato.
 */
export function useAnalysis(): AnalysisContextValue {
  const value = useContext(AnalysisContext);
  if (!value) {
    throw new Error("useAnalysis necesita estar dentro de <AnalysisProvider>.");
  }
  return value;
}

/**
 * Si el panel está delante, para quien solo necesita apartarse.
 *
 * No lanza sin provider: fuera de la pantalla del árbol la respuesta correcta
 * es «no», y no hay nada degradado que explicar. Al revés que `useAnalysis`,
 * que sí necesita un provider de verdad para hacer algo.
 */
export function useAnalysisOpen(): boolean {
  return useContext(AnalysisOpenContext);
}
