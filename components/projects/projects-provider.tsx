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

import { useBlocked } from "@/components/connection/connection-provider";
import type { Project, ProjectOverview } from "@/lib/backend/ports";
import { CONNECTION_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import {
  projectService,
  type NewProjectInput,
  type ProjectPatchInput,
} from "@/lib/services/projects";

/**
 * Los Proyectos del usuario, cargados una vez y compartidos.
 *
 * Vive en el shell y no en la página por una razón concreta: la sidebar pinta
 * un acceso directo por Proyecto y la pantalla pinta la lista, y son LOS
 * MISMOS datos. Con una carga por consumidor habría dos peticiones, dos
 * verdades y una sidebar que se queda con el Proyecto que acabas de borrar.
 *
 * Es cliente y no servidor porque el ADR 0001 lo decide así: el navegador habla
 * directo con PostgREST y la autorización se queda en RLS, de modo que no hay
 * camino de datos en el servidor por el que precargar esto. La página sigue
 * siendo un Server Component, pero solo para hacer de puerta.
 */

type Status = "loading" | "ready" | "error";

type ProjectsState = {
  status: Status;
  projects: ProjectOverview[];
  /** El mensaje del fallo, ya en español. `null` mientras no haya ninguno. */
  error: string | null;
};

type ProjectsContextValue = ProjectsState & {
  reload(): Promise<void>;
  create(input: NewProjectInput): Promise<void>;
  update(id: string, patch: ProjectPatchInput): Promise<void>;
  remove(id: string): Promise<void>;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/** Lo más nuevo primero, igual que ordena la vista. */
function byLastActivity(list: ProjectOverview[]): ProjectOverview[] {
  return [...list].sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime(),
  );
}

export function ProjectsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProjectsState>({
    status: "loading",
    projects: [],
    error: null,
  });

  // Una carga puede llegar tarde y pisar a la siguiente. El contador dice cuál
  // es la vigente; las respuestas de las viejas se tiran.
  const load = useRef(0);

  /**
   * Pide la lista y la deja en pantalla.
   *
   * NO marca «cargando» al entrar: el estado inicial ya lo está, y tocar el
   * estado de forma síncrona dentro de un efecto encadena repintados. Quien sí
   * lo marca es `reload`, que es lo que pulsa el usuario tras un fallo.
   */
  const fetchProjects = useCallback(async () => {
    const ticket = ++load.current;
    try {
      const projects = await projectService().list();
      if (ticket !== load.current) return;
      setState({ status: "ready", projects: byLastActivity(projects), error: null });
    } catch (error) {
      if (ticket !== load.current) return;
      setState({ status: "error", projects: [], error: errorMessage(error) });
    }
  }, []);

  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", error: null }));
    await fetchProjects();
  }, [fetchProjects]);

  // En un efecto y no durante el render: el cliente del proveedor resuelve su
  // URL contra `window.location.origin`, que en el servidor no existe.
  useEffect(() => {
    void (async () => {
      await fetchProjects();
    })();
  }, [fetchProjects]);

  /**
   * Mete la fila que devolvió el servicio en la lista que ya está en pantalla.
   *
   * Sin volver a pedir la lista entera, y no por ahorrar: el Autoguardado llama
   * a `update` una vez por ráfaga de tecleo, y una recarga por ráfaga haría
   * parpadear la pantalla mientras se escribe. Se puede hacer porque las cifras
   * son exactamente calculables — editar un Proyecto no cambia cuántas
   * Versiones ni cuántos Nodos tiene, y la última actividad pasa a ser el
   * `updatedAt` que acaba de devolver el motor, que por definición es el máximo.
   */
  const patchRow = useCallback((updated: Project) => {
    setState((prev) => ({
      ...prev,
      projects: byLastActivity(
        prev.projects.map((project) =>
          project.id === updated.id
            ? { ...project, ...updated, lastActivityAt: updated.updatedAt }
            : project,
        ),
      ),
    }));
  }, []);

  /**
   * ¿Prohibido escribir? El portazo va ADEMÁS de que los botones se apaguen.
   *
   * Aquí no hay espejo: las tres operaciones lo leen del render, y por eso ven
   * la red caída en el mismo repintado en que se cae. Recrearlas cuesta un
   * repintado y solo al cambiar la conexión —no en cada tecla—, que es lo que
   * hacía falta comprobar antes de temerlo. Ver `TreeProvider`.
   */
  const blocked = useBlocked();

  const create = useCallback(async (input: NewProjectInput) => {
    if (blocked) throw new Error(CONNECTION_COPY.blocked);
    const project = await projectService().create(input);
    setState((prev) => ({
      ...prev,
      status: "ready",
      error: null,
      projects: byLastActivity([
        {
          ...project,
          // Recién nacido: su Versión inicial y nada más. Es lo que garantiza
          // el alta, así que no hace falta preguntarlo.
          versionCount: 1,
          nodeCount: 0,
          analysisCount: 0,
          lastActivityAt: project.updatedAt,
        },
        ...prev.projects,
      ]),
    }));
  }, [blocked]);

  const update = useCallback(
    async (id: string, patch: ProjectPatchInput) => {
      if (blocked) throw new Error(CONNECTION_COPY.blocked);
      patchRow(await projectService().update(id, patch));
    },
    [blocked, patchRow],
  );

  const remove = useCallback(async (id: string) => {
    if (blocked) throw new Error(CONNECTION_COPY.blocked);
    await projectService().remove(id);
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((project) => project.id !== id),
    }));
  }, [blocked]);

  const value = useMemo(
    () => ({ ...state, reload, create, update, remove }),
    [state, reload, create, update, remove],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

/**
 * Los Proyectos y lo que se puede hacer con ellos.
 *
 * @throws si se usa fuera del shell. Es deliberado: un componente que necesita
 * Proyectos y está fuera del provider no tiene un estado degradado sensato —
 * pintaría una lista vacía para siempre, que es peor que un error.
 */
export function useProjects(): ProjectsContextValue {
  const value = useContext(ProjectsContext);
  if (!value) {
    throw new Error("useProjects necesita estar dentro de <ProjectsProvider>.");
  }
  return value;
}
