"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useDebouncedWrite } from "@/components/autosave/debounced-write";
import { useBlocked } from "@/components/connection/connection-provider";
import {
  planLabelSave,
  VERSION_LABEL_DEBOUNCE_MS,
} from "@/components/versions/autosave";
import type { ProjectVersion } from "@/lib/backend/ports";
import { CONNECTION_COPY, ROUTES, VERSIONS_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { versionService } from "@/lib/services/versions";

/**
 * Las Versiones de un Proyecto, y cuál se está editando.
 *
 * Vive en un provider por lo mismo que `TreeProvider`: los mismos datos los
 * usan cuatro cosas a la vez —el disparador de la cabecera, la lista del
 * desplegable y los dos diálogos— y con una carga por consumidor habría cuatro
 * peticiones y cuatro verdades.
 *
 * ── Por qué es un provider APARTE del árbol ───────────────────────────────
 *
 * Porque son dos ritmos y dos vidas. El árbol se recarga entero cuando cambias
 * de Versión; la lista de Versiones no, es la misma. Metiéndolos juntos,
 * navegar de v7 a v3 tiraría la lista para volver a pedirla igual, y el
 * desplegable parpadearía cada vez que se usa.
 *
 * ── Quién comprueba la URL, y quién la hace cumplir ───────────────────────
 *
 * Esto COMPRUEBA. La Versión viaja en la URL desde #14 y una URL se edita a
 * mano, así que `versionId` es una AFIRMACIÓN hasta que se demuestre. Buscarla
 * en la lista que ya se pidió responde de una vez a las tres preguntas
 * —¿existe?, ¿es tuya?, ¿es de este Proyecto?— sin una consulta de más. Ver
 * `VersionService.list`.
 *
 * Quien lo hace CUMPLIR es `VersionGate`, y hacen falta los dos: un `current` a
 * nulo que nadie mira no impide nada, y bajo RLS leer el árbol de una Versión
 * ajena no falla — devuelve cero filas. Sin la puerta, el fallo se disfrazaba
 * de Versión vacía con el botón de crear activo.
 *
 * ── Cómo se guarda ────────────────────────────────────────────────────────
 *
 * Igual que el árbol, y por lo mismo (`CONTEXT.md`): renombrar rebota
 * `VERSION_LABEL_DEBOUNCE_MS` y no hay botón de guardar; clonar y borrar se
 * escriben en el acto y después se RELEE la lista, porque clonar asigna un
 * número que decide el motor y no se puede adivinar desde aquí.
 *
 * «Igual que el árbol» es literal desde #24: el rebote, la retención sin red y
 * las tres salidas de la pantalla las pone `useDebouncedWrite`, el mismo hook
 * que usa `TreeProvider`. Lo de aquí es qué se escribe y qué se enseña.
 */

type Status = "loading" | "ready" | "error";

/** Lo que el Autoguardado le está haciendo a la etiqueta. Ver `SaveState`. */
export type LabelSaveState = "saved" | "saving" | "error" | "pending";

type VersionsState = {
  status: Status;
  versions: ProjectVersion[];
  /** El fallo que impide pintar la lista, ya en español. */
  error: string | null;
  save: LabelSaveState;
  saveError: string | null;
};

type VersionsContextValue = {
  status: Status;
  versions: ProjectVersion[];
  /** La Versión abierta. `null` mientras carga, o si la URL miente. */
  current: ProjectVersion | null;
  error: string | null;
  save: LabelSaveState;
  saveError: string | null;
  /** Si borrar está permitido: la última que queda no se puede. */
  canDelete: boolean;

  /** Lo que va en el campo: el borrador si lo hay, si no lo guardado. */
  labelOf(version: ProjectVersion): string;

  reload(): Promise<void>;
  setLabel(id: string, label: string): void;
  /**
   * Escribe ya lo que quede pendiente. Al cerrar el campo o el desplegable.
   *
   * Devuelve si la etiqueta quedó A SALVO. El desplegable no lo mira —cerrar
   * un menú no depende de que la escritura fuera bien, y el pie ya lo cuenta—,
   * pero se dice porque es la misma respuesta de la que dependen `clone` y
   * `remove`, y devolver `void` aquí obligaría a tener dos verdades.
   */
  flushLabel(): Promise<boolean>;

  /** Clona y NAVEGA al clon: se clona para trabajar en el clon. */
  clone(id: string, label: string | null): Promise<void>;
  /** Borra y, si era la abierta, abre la que quede más reciente. */
  remove(id: string): Promise<void>;
};

const VersionsContext = createContext<VersionsContextValue | null>(null);

export function VersionsProvider({
  projectId,
  versionId,
  children,
}: {
  projectId: string;
  /** La Versión que pide la URL. Una afirmación, hasta que se encuentre. */
  versionId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<VersionsState>({
    status: "loading",
    versions: [],
    error: null,
    save: "saved",
    saveError: null,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  /**
   * ¿Prohibido escribir? Mismo reparto que en `TreeProvider`: los guardianes
   * leen esto, y solo lo que dispara fuera del render mira el espejo.
   */
  const blocked = useBlocked();

  // Espejos de lo que necesita el Autoguardado. El rebote dispara fuera del
  // render, así que leer el estado desde su cierre daría el de hace medio
  // segundo — que es justo el que se quiere pisar. Igual que en `TreeProvider`.
  const versionsRef = useRef<ProjectVersion[]>([]);
  const draftsRef = useRef<Record<string, string>>({});

  // Una carga puede llegar tarde y pisar a la siguiente. El contador dice cuál
  // es la vigente; las respuestas de las viejas se tiran.
  const loadTicket = useRef(0);

  const putVersions = useCallback((versions: ProjectVersion[]) => {
    versionsRef.current = versions;
  }, []);

  const fetchVersions = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const versions = await versionService().list(projectId);
      if (ticket !== loadTicket.current) return;
      putVersions(versions);
      setState({
        status: "ready",
        versions,
        error: null,
        save: "saved",
        saveError: null,
      });
    } catch (error) {
      if (ticket !== loadTicket.current) return;
      setState((prev) => ({
        ...prev,
        status: "error",
        versions: [],
        error: errorMessage(error),
      }));
    }
  }, [projectId, putVersions]);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    await fetchVersions();
  }, [fetchVersions]);

  // En un efecto y no durante el render: el cliente del proveedor resuelve su
  // URL contra `window.location.origin`, que en el servidor no existe.
  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  const current = state.versions.find((version) => version.id === versionId) ?? null;

  /* ── La etiqueta ────────────────────────────────────────────────────── */

  /**
   * Escribe el borrador de una etiqueta si difiere de lo guardado.
   *
   * El borrador NO se descarta al escribirlo, igual que en el árbol: mientras
   * el campo siga abierto, lo que se ve es lo que el usuario tecleó.
   *
   * Devuelve si la etiqueta quedó A SALVO —`true` también cuando no había nada
   * que escribir—, y eso es lo que hace que clonar y borrar se paren cuando el
   * renombrado falló, igual que mover un Nodo se para cuando falla su texto.
   */
  const writeLabel = useCallback(
    async (id: string): Promise<boolean> => {
      const draft = draftsRef.current[id];
      if (draft === undefined) return true;

      const saved = versionsRef.current.find((version) => version.id === id);
      // La Versión se borró mientras el rebote esperaba. No hay a quién
      // escribirle.
      if (!saved) return true;

      const plan = planLabelSave(draft, saved.label);
      if (plan.kind === "idle") {
        // Nada que escribir, pero el pie puede estar diciendo «Guardando…»
        // porque `setLabel` lo marcó al teclear: volver a lo que ya estaba
        // guardado también es quedarse a salvo.
        setState((prev) => (prev.save === "saving" ? { ...prev, save: "saved" } : prev));
        return true;
      }

      try {
        const updated = await versionService().rename(id, plan.label);
        // Se copia SOLO la etiqueta, no la fila entera. Esta respuesta puede
        // llegar después de una relectura, y la fila que trae es de antes.
        const versions = versionsRef.current.map((version) =>
          version.id === id
            ? { ...version, label: updated.label, updatedAt: updated.updatedAt }
            : version,
        );
        putVersions(versions);
        setState((prev) => ({ ...prev, versions, save: "saved", saveError: null }));
        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          save: "error",
          saveError: errorMessage(error),
        }));
        return false;
      }
    },
    [putVersions],
  );

  /**
   * Lo que el pie enseña cuando el rebote retiene y cuando suelta.
   *
   * Los gemelos de los de `TreeProvider`, y se quedan aquí por lo que se
   * explica allí: el hook decide cuándo, pero `LabelSaveState` es estado de
   * esta pantalla y el `setState` que lo mueve no puede vivir en otra.
   */
  const onHold = useCallback(() => {
    setState((prev) => ({ ...prev, save: "pending", saveError: null }));
  }, []);

  const onRelease = useCallback(() => {
    setState((prev) => ({ ...prev, save: "saving", saveError: null }));
  }, []);

  /**
   * El rebote, la retención sin red y las tres salidas de la pantalla.
   *
   * El MISMO módulo que usa `TreeProvider` (#24): hasta entonces esto era una
   * transcripción línea a línea de aquello, y la copia de aquí ya había
   * empezado a divergir —re-retenía en cada repintado lo que ya estaba
   * retenido, que es justo la fila que `movePending` existe para evitar—.
   */
  const { schedule, flushPending } = useDebouncedWrite({
    delayMs: VERSION_LABEL_DEBOUNCE_MS,
    write: writeLabel,
    blocked,
    onHold,
    onRelease,
  });

  const setLabel = useCallback(
    (id: string, label: string) => {
      draftsRef.current = { ...draftsRef.current, [id]: label };
      setDrafts(draftsRef.current);
      // «Guardando…» desde la PRIMERA tecla, no desde que sale la petición: el
      // mismo criterio que el árbol, y por lo mismo — durante el rebote la
      // etiqueta vive solo en la pantalla.
      setState((prev) =>
        prev.save === "saving" ? prev : { ...prev, save: "saving", saveError: null },
      );
      schedule(id);
    },
    [schedule],
  );

  const labelOf = useCallback(
    (version: ProjectVersion) => drafts[version.id] ?? version.label ?? "",
    [drafts],
  );

  /* ── La lista ───────────────────────────────────────────────────────── */

  const clone = useCallback(
    async (id: string, label: string | null) => {
      // El portazo, leyendo el valor del render y no el espejo. Ver `run` en
      // `TreeProvider` sobre por qué esa diferencia es la que lo hace valer.
      if (blocked) throw new Error(CONNECTION_COPY.blocked);
      // Lo tecleado va ANTES: renombrar y clonar tocan la misma lista, y la
      // relectura de después tiene que traer las dos cosas. Y si la etiqueta
      // NO se pudo guardar, aquí se para: seguir dejaría dos Versiones
      // llamándose igual, con el nombre nuevo viviendo solo en la pantalla.
      if (!(await flushPending())) throw new Error(VERSIONS_COPY.blockedByLabel);
      const created = await versionService().clone(id, label);
      await fetchVersions();
      // Se clona para trabajar en el clon: quedarse en el origen obligaría a
      // desplegar el menú y elegirlo, que es el paso que nadie quiere dar.
      router.push(ROUTES.version(projectId, created.id));
    },
    [blocked, fetchVersions, flushPending, projectId, router],
  );

  const remove = useCallback(
    async (id: string) => {
      if (blocked) throw new Error(CONNECTION_COPY.blocked);
      // Igual que al clonar: la confirmación acaba de enseñar un nombre, y
      // borrar sobre una etiqueta que no llegó a persistirse dejaría al
      // usuario creyendo que se llevó por delante una Versión distinta.
      if (!(await flushPending())) throw new Error(VERSIONS_COPY.blockedByLabel);
      await versionService().remove(id);
      const versions = await versionService().list(projectId);
      putVersions(versions);
      setState((prev) => ({ ...prev, versions, status: "ready", error: null }));

      // Si cayó la que estabas mirando, la URL apunta a algo que ya no está.
      // `replace` y no `push`: volver atrás a una Versión borrada solo llevaría
      // a un error.
      if (id === versionId) {
        const [newest] = versions;
        if (newest) router.replace(ROUTES.version(projectId, newest.id));
      }
    },
    [blocked, flushPending, projectId, putVersions, router, versionId],
  );

  const value = useMemo(
    () => ({
      status: state.status,
      versions: state.versions,
      current,
      // Solo los fallos de RED. Que la lista no tenga la Versión de la URL no
      // es un error del provider: es `current` a nulo, y quien lo cuenta —con
      // sus palabras y con una salida— es `VersionGate`.
      error: state.error,
      save: state.save,
      saveError: state.saveError,
      // La regla la aplica el puerto —es quien puede contarlas sin una lectura
      // de más— y la pantalla solo la refleja. Ver `VersionService.remove`.
      canDelete: state.versions.length > 1,
      labelOf,
      reload,
      setLabel,
      flushLabel: flushPending,
      clone,
      remove,
    }),
    [state, current, labelOf, reload, setLabel, flushPending, clone, remove],
  );

  return (
    <VersionsContext.Provider value={value}>{children}</VersionsContext.Provider>
  );
}

/**
 * Las Versiones del Proyecto abierto.
 *
 * @throws si se usa fuera de la pantalla. Deliberado, igual que `useTree`: un
 * selector de Versiones sin Versiones no tiene estado degradado sensato.
 */
export function useVersions(): VersionsContextValue {
  const value = useContext(VersionsContext);
  if (!value) {
    throw new Error("useVersions necesita estar dentro de <VersionsProvider>.");
  }
  return value;
}
