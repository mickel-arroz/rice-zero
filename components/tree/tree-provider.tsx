"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  NODE_TEXT_DEBOUNCE_MS,
  planNodeSave,
} from "@/components/tree/autosave";
import type { TreeNode } from "@/lib/backend/ports";
import { TREE_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { nodeService } from "@/lib/services/nodes";
import { treeRows, type TreeRow } from "@/lib/tree/rows";

/**
 * El árbol de la Versión abierta, y todo lo que se puede hacerle.
 *
 * Vive en un provider y no en la pantalla porque los mismos datos los usan
 * cuatro cosas a la vez —la lista, la barra de acciones, el selector de
 * destino y la confirmación de borrado— y con una carga por consumidor habría
 * cuatro peticiones y cuatro verdades.
 *
 * Y vive en `components/tree` y no dentro de una vista porque las DOS vistas
 * —Registro y Canvas— son el mismo árbol pintado de dos maneras. Al montarlo
 * la página y no la pantalla, alternar entre vistas no desmonta nada: no hay
 * segunda carga, no se pierde la selección ni lo tecleado a medio guardar, y
 * un cambio hecho en una vista ya está hecho al llegar a la otra. Ése es
 * exactamente el criterio «alternar sin perder estado ni datos» del ticket, y
 * se cumple por dónde está montado esto, no por código que lo sincronice.
 *
 * Es de cliente por lo mismo que `ProjectsProvider` (ADR 0001): el navegador
 * habla directo con PostgREST y la autorización se queda en RLS, así que no
 * hay camino de datos en el servidor por el que precargar esto.
 *
 * ── Cómo se guarda ────────────────────────────────────────────────────────
 *
 * «Todo cambio mínimo se persiste de inmediato; no existe botón guardar»
 * (`CONTEXT.md`), y eso se reparte en dos ritmos:
 *
 *   · ESTRUCTURA (crear, mover, re-parentar, borrar) — se escribe en el acto
 *     y después se RELEE el árbol entero. Releer parece caro y es la única
 *     opción honesta: `createSibling` y `reorder` reescriben el `orderIndex`
 *     de varios hermanos a la vez, así que lo que quedó guardado no se puede
 *     deducir desde aquí sin reimplementar el plan del dominio en la pantalla.
 *   · TEXTO — rebota `NODE_TEXT_DEBOUNCE_MS` y NO relee: teclear no puede
 *     cambiar la estructura, así que basta con actualizar la fila.
 */

type Status = "loading" | "ready" | "error";

/**
 * Lo que el Autoguardado le está haciendo al árbol ahora mismo.
 *
 * Vive aquí y no junto a la política de rebote porque es ESTADO del provider,
 * no una decisión: `autosave.ts` contesta «¿hay que escribir?», y esto es lo
 * que la cabecera enseña mientras se escribe.
 */
export type SaveState = "saved" | "saving" | "error";

type TreeState = {
  status: Status;
  nodes: TreeNode[];
  /** El fallo que impide pintar el árbol, ya en español. */
  error: string | null;
  save: SaveState;
  /** El fallo del último guardado, ya en español. */
  saveError: string | null;
};

type TreeContextValue = {
  status: Status;
  error: string | null;
  save: SaveState;
  saveError: string | null;
  /** El árbol aplanado, listo para pintar con sus líneas. */
  rows: TreeRow[];
  nodes: TreeNode[];
  selectedId: string | null;
  /** El Nodo cuyo texto está abierto para escribir. Nunca dos a la vez. */
  editingId: string | null;

  /** Lo que hay que enseñar en el campo: el borrador si lo hay, si no lo guardado. */
  textOf(node: TreeNode): string;

  reload(): Promise<void>;
  select(id: string | null): void;
  startEditing(id: string): void;
  stopEditing(): void;
  setText(id: string, content: string): void;

  createRoot(): Promise<void>;
  createChild(parentId: string): Promise<void>;
  createSibling(siblingId: string): Promise<void>;
  /** Mueve un Nodo entre sus hermanos. El destino se recorta al rango. */
  moveTo(nodeId: string, toIndex: number): Promise<void>;
  reparent(nodeId: string, parentId: string | null): Promise<void>;
  remove(nodeId: string): Promise<void>;
};

const TreeContext = createContext<TreeContextValue | null>(null);

export function TreeProvider({
  versionId,
  children,
}: {
  /**
   * La Versión abierta, ya comprobada por `VersionsProvider`.
   *
   * Llega HECHA y no se deduce aquí: desde #14 la Versión viaja en la URL, y
   * quien la valida es el provider que ya tiene la lista del Proyecto delante.
   * Un segundo sitio que resolviera «cuál estoy editando» sería un segundo
   * sitio del que podría salir otra respuesta.
   */
  versionId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<TreeState>({
    status: "loading",
    nodes: [],
    error: null,
    save: "saved",
    saveError: null,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Espejos de lo que necesita el Autoguardado. El rebote dispara fuera del
  // render, así que leer el estado desde su cierre daría el de hace medio
  // segundo — que es justo el que se quiere pisar.
  const nodesRef = useRef<TreeNode[]>([]);
  const draftsRef = useRef<Record<string, string>>({});

  // Una carga puede llegar tarde y pisar a la siguiente. El contador dice cuál
  // es la vigente; las respuestas de las viejas se tiran. Igual que en
  // `ProjectsProvider`.
  const loadTicket = useRef(0);

  /** El texto pendiente de escribir. Solo puede haber uno: ver `schedule`. */
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );

  /** La escritura de texto que ya salió y todavía no ha vuelto. */
  const inFlight = useRef<Promise<boolean> | null>(null);

  const putNodes = useCallback((nodes: TreeNode[]) => {
    nodesRef.current = nodes;
  }, []);

  const fetchTree = useCallback(async () => {
    const ticket = ++loadTicket.current;
    try {
      const nodes = await nodeService().list(versionId);
      if (ticket !== loadTicket.current) return;
      putNodes(nodes);
      setState({
        status: "ready",
        nodes,
        error: null,
        save: "saved",
        saveError: null,
      });
    } catch (error) {
      if (ticket !== loadTicket.current) return;
      setState((prev) => ({
        ...prev,
        status: "error",
        nodes: [],
        error: errorMessage(error),
      }));
    }
  }, [versionId, putNodes]);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    await fetchTree();
  }, [fetchTree]);

  // En un efecto y no durante el render: el cliente del proveedor resuelve su
  // URL contra `window.location.origin`, que en el servidor no existe.
  useEffect(() => {
    void fetchTree();
  }, [fetchTree]);

  /* ── Texto ──────────────────────────────────────────────────────────── */

  /**
   * Escribe el borrador de un Nodo si difiere de lo guardado.
   *
   * Devuelve si el texto quedó a salvo: `true` también cuando no había nada
   * que escribir. Quien lo llama lo NECESITA — un cambio de estructura encima
   * de un texto que no se guardó acabaría diciendo «Guardado» sobre una idea
   * perdida.
   *
   * El borrador NO se descarta al escribirlo: mientras la pantalla siga
   * abierta, lo que se ve en el campo es lo que el usuario tecleó. Descartarlo
   * dejaría que una relectura posterior pisara el campo con el texto de antes
   * en mitad de una frase.
   */
  const writeText = useCallback(
    async (id: string): Promise<boolean> => {
      const draft = draftsRef.current[id];
      if (draft === undefined) return true;

      const saved = nodesRef.current.find((node) => node.id === id)?.content;
      // El Nodo se borró mientras el rebote esperaba. No hay a quién escribirle.
      if (saved === undefined) return true;

      const plan = planNodeSave(draft, saved);
      // Nada que escribir, pero el pie puede estar diciendo «Guardando…»
      // porque `setText` lo marcó al teclear: volver a lo que ya estaba
      // guardado también es quedarse a salvo.
      if (plan.kind === "idle") {
        setState((prev) =>
          prev.save === "saving" ? { ...prev, save: "saved" } : prev,
        );
        return true;
      }

      try {
        const updated = await nodeService().edit(id, plan.content);
        // Se copia SOLO el texto, no la fila entera que devolvió el motor. Esta
        // respuesta puede llegar DESPUÉS de un movimiento que ya se guardó, y
        // la fila que trae es de antes: pisar el árbol con ella devolvería el
        // Nodo al sitio del que acaba de salir hasta la siguiente recarga.
        const nodes = nodesRef.current.map((node) =>
          node.id === id
            ? { ...node, content: updated.content, updatedAt: updated.updatedAt }
            : node,
        );
        putNodes(nodes);
        setState((prev) => ({ ...prev, nodes, save: "saved", saveError: null }));
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
    [putNodes],
  );

  /** Lo mismo, dejando constancia de que hay una escritura EN VUELO. */
  const flush = useCallback(
    (id: string): Promise<boolean> => {
      const work = writeText(id).finally(() => {
        if (inFlight.current === work) inFlight.current = null;
      });
      inFlight.current = work;
      return work;
    },
    [writeText],
  );

  /**
   * Programa la escritura del Nodo que se está tecleando.
   *
   * Solo hay UN rebote vivo, y cambiar de Nodo vacía el anterior en el acto en
   * vez de cancelarlo: sin eso, escribir en A y saltar a B perdería lo tecleado
   * en A si B se guarda antes y el usuario cierra la pantalla en medio.
   */
  const schedule = useCallback(
    (id: string) => {
      const current = pending.current;
      if (current) {
        clearTimeout(current.timer);
        if (current.id !== id) void flush(current.id);
      }
      pending.current = {
        id,
        timer: setTimeout(() => {
          pending.current = null;
          void flush(id);
        }, NODE_TEXT_DEBOUNCE_MS),
      };
    },
    [flush],
  );

  /**
   * Deja el texto a salvo antes de tocar la estructura. Devuelve si lo logró.
   *
   * Espera DOS cosas y no una: el rebote que aún no ha disparado, y la
   * escritura que el temporizador pudo lanzar hace un instante. Sin esperar la
   * segunda, su respuesta aterrizaría después de la relectura y pisaría el
   * árbol recién leído con la fila de antes del movimiento.
   */
  const flushPending = useCallback(async (): Promise<boolean> => {
    const settled = (await inFlight.current) ?? true;

    const current = pending.current;
    if (!current) return settled;
    clearTimeout(current.timer);
    pending.current = null;
    return (await flush(current.id)) && settled;
  }, [flush]);

  const setText = useCallback(
    (id: string, content: string) => {
      draftsRef.current = { ...draftsRef.current, [id]: content };
      setDrafts(draftsRef.current);
      // «Guardando…» desde la PRIMERA tecla, no desde que sale la petición.
      // Durante el rebote hay medio segundo en el que la idea vive solo en la
      // pantalla, y un pie que dijera «Guardado» ahí estaría mintiendo — que
      // es justo lo que el criterio «recargar nunca pierde un cambio
      // confirmado» prohíbe: lo que la app da por guardado, lo está.
      setState((prev) =>
        prev.save === "saving" ? prev : { ...prev, save: "saving", saveError: null },
      );
      schedule(id);
    },
    [schedule],
  );

  /**
   * Escribe YA lo que quede pendiente. Las tres salidas de la pantalla.
   *
   * El rebote de medio segundo es la única ventana en la que una idea escrita
   * puede no estar guardada, y «recargar nunca pierde un cambio confirmado» es
   * un criterio del ticket. Así que se cierra por los tres lados:
   *
   *   · `visibilitychange` a oculto — cambiar de app o de pestaña en el móvil,
   *     que es lo que pasa justo antes de cerrar el navegador.
   *   · `pagehide` — recargar, cerrar, o navegar fuera del sitio.
   *   · el desmontaje — navegar DENTRO de la app, donde no ocurre ninguno de
   *     los dos anteriores.
   *
   * Lo que no se puede prometer es una recarga forzada con el dedo todavía
   * escribiendo: la petición sale, pero la navegación puede cancelarla. Por eso
   * además se escribe al cerrar el campo (`stopEditing`), que es lo que pasa de
   * verdad antes de tocar cualquier otra cosa.
   */
  useEffect(() => {
    function leaving() {
      const current = pending.current;
      if (!current) return;
      clearTimeout(current.timer);
      pending.current = null;
      void flush(current.id);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") leaving();
    }

    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", onVisibility);
      leaving();
    };
  }, [flush]);

  const textOf = useCallback(
    (node: TreeNode) => drafts[node.id] ?? node.content,
    [drafts],
  );

  /* ── Estructura ─────────────────────────────────────────────────────── */

  /**
   * Ejecuta una escritura de estructura y deja el árbol como quedó de verdad.
   *
   * @param write devuelve, si quiere, el Nodo que hay que dejar seleccionado
   *   y en edición — que es siempre el recién creado: un Nodo nuevo nace
   *   vacío, y lo siguiente que va a pasar es que alguien escriba en él.
   */
  const run = useCallback(
    async (write: () => Promise<TreeNode | void>) => {
      // Lo tecleado va ANTES que el cambio de estructura: las dos escrituras
      // tocan la misma fila y la relectura de después tiene que traer las dos.
      // Y si el texto NO se pudo guardar, aquí se para: seguir dejaría el pie
      // diciendo «Guardado» sobre una idea que nunca llegó a persistirse, que
      // es exactamente la mentira que este ticket promete no contar.
      if (!(await flushPending())) throw new Error(TREE_COPY.blockedByText);

      setState((prev) => ({ ...prev, save: "saving", saveError: null }));
      try {
        const created = await write();
        const nodes = await nodeService().list(versionId);
        putNodes(nodes);
        setState((prev) => ({
          ...prev,
          nodes,
          save: "saved",
          saveError: null,
        }));
        if (created) {
          setSelectedId(created.id);
          setEditingId(created.id);
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          save: "error",
          saveError: errorMessage(error),
        }));
        // Se relanza para que quien abrió un diálogo sepa que no se cierre.
        throw error;
      }
    },
    [flushPending, putNodes, versionId],
  );

  const createRoot = useCallback(
    () => run(() => nodeService().createRoot(versionId)),
    [run, versionId],
  );

  const createChild = useCallback(
    (parentId: string) => run(() => nodeService().createChild(versionId, parentId)),
    [run, versionId],
  );

  const createSibling = useCallback(
    (siblingId: string) =>
      run(() => nodeService().createSibling(versionId, siblingId)),
    [run, versionId],
  );

  const moveTo = useCallback(
    (nodeId: string, toIndex: number) =>
      run(async () => {
        await nodeService().reorder(versionId, nodeId, toIndex);
      }),
    [run, versionId],
  );

  const reparent = useCallback(
    (nodeId: string, parentId: string | null) =>
      run(async () => {
        await nodeService().reparent(versionId, nodeId, parentId);
      }),
    [run, versionId],
  );

  const remove = useCallback(
    async (nodeId: string) => {
      await run(async () => {
        await nodeService().remove(nodeId);
      });
      // Después del borrado y no antes: si la escritura falla, el Nodo sigue
      // ahí y quitarle la selección solo habría escondido sus acciones.
      setSelectedId((current) => (current === nodeId ? null : current));
      setEditingId((current) => (current === nodeId ? null : current));
    },
    [run],
  );

  /* ── Selección ──────────────────────────────────────────────────────── */

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    // Cambiar de Nodo cierra el campo del anterior: el teclado del teléfono
    // tapa la barra de acciones, así que abrirlo tiene que ser una decisión y
    // no un efecto secundario de tocar otra fila.
    setEditingId((current) => (current === id ? current : null));
  }, []);

  const startEditing = useCallback((id: string) => {
    setSelectedId(id);
    setEditingId(id);
  }, []);

  /**
   * Cierra el campo y escribe sin esperar al rebote.
   *
   * Cerrar el campo es lo que hace una persona ANTES de tocar cualquier otra
   * cosa —otra fila, un botón de la barra, el navegador—, así que ahí el medio
   * segundo de rebote deja de ser una comodidad y pasa a ser una ventana por la
   * que se pierde una idea.
   */
  const stopEditing = useCallback(() => {
    setEditingId(null);
    void flushPending();
  }, [flushPending]);

  const rows = useMemo(() => treeRows(state.nodes), [state.nodes]);

  const value = useMemo(
    () => ({
      status: state.status,
      error: state.error,
      save: state.save,
      saveError: state.saveError,
      nodes: state.nodes,
      rows,
      selectedId,
      editingId,
      textOf,
      reload,
      select,
      startEditing,
      stopEditing,
      setText,
      createRoot,
      createChild,
      createSibling,
      moveTo,
      reparent,
      remove,
    }),
    [
      state,
      rows,
      selectedId,
      editingId,
      textOf,
      reload,
      select,
      startEditing,
      stopEditing,
      setText,
      createRoot,
      createChild,
      createSibling,
      moveTo,
      reparent,
      remove,
    ],
  );

  return <TreeContext.Provider value={value}>{children}</TreeContext.Provider>;
}

/**
 * El árbol abierto y lo que se puede hacerle.
 *
 * @throws si se usa fuera de la pantalla. Deliberado, igual que `useProjects`:
 * un componente del Registro sin árbol no tiene estado degradado sensato.
 */
export function useTree(): TreeContextValue {
  const value = useContext(TreeContext);
  if (!value) {
    throw new Error("useTree necesita estar dentro de <TreeProvider>.");
  }
  return value;
}
