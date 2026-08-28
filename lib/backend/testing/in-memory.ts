/**
 * El adaptador en memoria.
 *
 * Implementa el mismo `RowStore` que Neon y Supabase, así que la contract suite
 * que corre contra él ejercita el núcleo compartido de verdad — no un doble que
 * dice sí a todo. Para que eso valga algo, aquí se reproducen las cosas que en
 * el motor real hace el esquema y no el cliente:
 *
 *   · RLS owner-only: una fila que no es tuya no existe.
 *   · `owner_id` lo pone la sesión, nunca el llamante.
 *   · `version_number` lo asigna un trigger, denso y monótono por Proyecto.
 *   · `updated_at` se toca en cada update.
 *   · un Nodo y su padre viven siempre en la misma Versión.
 *   · los `check` de longitud de título y etiqueta.
 *   · borrar cascadea: Proyecto → Versiones → Nodos y Análisis; Nodo → subárbol.
 *   · clonar copia el árbol entero con la jerarquía remapeada, y no los Análisis.
 *
 * Lo que NO reproduce, a propósito: la concurrencia. El lock advisory del
 * trigger y el constraint trigger diferido existen para carreras que un objeto
 * en memoria no puede tener, y fingirlas daría una confianza falsa. Eso se
 * verifica contra el motor real (`npm run verify:neon`).
 */

import type { TableName } from "@/lib/backend/adapters/postgrest/rows";
import type { Filter, Order, Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import { createRepositories } from "@/lib/backend/adapters/postgrest/kernel";
import {
  ConflictError,
  NotFoundError,
  UnauthenticatedError,
  type AuthProvider,
  type AuthSession,
  type BackendProvider,
} from "@/lib/backend/ports";

type StoredUser = {
  id: string;
  email: string;
  password: string;
  emailVerified: boolean;
};

type Tables = Record<TableName, Row[]>;

/**
 * Un backend en memoria, más las dos palancas que en un backend real no son
 * código sino un humano: confirmar un email y empezar de cero.
 */
export type InMemoryBackend = BackendProvider & {
  /** Lo que haría el usuario al pinchar el enlace del correo. */
  verifyEmail(email: string): void;
  /** Vacía usuarios y datos. */
  reset(): void;
};

let sequence = 0;

/** Ids con forma de uuid pero deterministas: un test que falla se lee mejor. */
function nextId(): string {
  sequence += 1;
  const hex = sequence.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function requireText(value: unknown, field: string, min: number, max: number): void {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) {
    throw new ConflictError(
      "check",
      `${field} debe tener entre ${min} y ${max} caracteres.`,
    );
  }
}

function matches(row: Row, where: Filter[]): boolean {
  return where.every((filter) => row[filter.column] === filter.value);
}

/** Ordena como el motor, incluida la posición de los nulos, que es explícita. */
function compare(a: unknown, b: unknown, ascending: boolean, nullsFirst: boolean): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return nullsFirst ? -1 : 1;
  if (b === null || b === undefined) return nullsFirst ? 1 : -1;
  const direction = ascending ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
  return String(a).localeCompare(String(b)) * direction;
}

function sortRows(rows: Row[], order: Order[]): Row[] {
  if (order.length === 0) return rows;
  return [...rows].sort((left, right) => {
    for (const { column, ascending, nullsFirst } of order) {
      const result = compare(left[column], right[column], ascending, nullsFirst);
      if (result !== 0) return result;
    }
    return 0;
  });
}

export function createInMemoryBackend(): InMemoryBackend {
  const users = new Map<string, StoredUser>();
  let session: StoredUser | null = null;
  let tables: Tables = { projects: [], project_versions: [], nodes: [], ai_analyses: [] };

  function currentUserId(): string {
    if (!session) throw new UnauthenticatedError();
    return session.id;
  }

  // ── RLS ────────────────────────────────────────────────────────────────
  // Cada tabla resuelve la propiedad subiendo hasta `projects`, igual que
  // hacen `is_project_owner` e `is_version_owner` en la migración.

  function ownsProject(projectId: unknown): boolean {
    return tables.projects.some(
      (row) => row.id === projectId && row.owner_id === currentUserId(),
    );
  }

  function ownsVersion(versionId: unknown): boolean {
    const version = tables.project_versions.find((row) => row.id === versionId);
    return version ? ownsProject(version.project_id) : false;
  }

  function isVisible(table: TableName, row: Row): boolean {
    switch (table) {
      case "projects":
        return row.owner_id === currentUserId();
      case "project_versions":
        return ownsProject(row.project_id);
      case "nodes":
      case "ai_analyses":
        return ownsVersion(row.version_id);
    }
  }

  function visible(table: TableName): Row[] {
    return tables[table].filter((row) => isVisible(table, row));
  }

  // ── Invariantes del esquema ────────────────────────────────────────────

  function assertParentSameVersion(row: Row): void {
    if (row.parent_id == null) return;
    if (row.parent_id === row.id) {
      throw new ConflictError("check", "Un Nodo nunca es su propio padre.");
    }
    const parent = tables.nodes.find((node) => node.id === row.parent_id);
    if (parent && parent.version_id !== row.version_id) {
      throw new ConflictError(
        "referencia",
        "El Nodo y su padre deben estar en la misma Versión.",
      );
    }
  }

  /** El equivalente del trigger `assign_version_number`. */
  function nextVersionNumber(projectId: unknown): number {
    const used = tables.project_versions
      .filter((row) => row.project_id === projectId)
      .map((row) => Number(row.version_number));
    return used.length === 0 ? 1 : Math.max(...used) + 1;
  }

  // ── Cascadas ───────────────────────────────────────────────────────────

  function deleteNodeSubtree(nodeId: unknown): void {
    const children = tables.nodes.filter((row) => row.parent_id === nodeId);
    tables.nodes = tables.nodes.filter((row) => row.id !== nodeId);
    for (const child of children) deleteNodeSubtree(child.id);
  }

  function deleteVersion(versionId: unknown): void {
    tables.nodes = tables.nodes.filter((row) => row.version_id !== versionId);
    tables.ai_analyses = tables.ai_analyses.filter(
      (row) => row.version_id !== versionId,
    );
    tables.project_versions = tables.project_versions.filter(
      (row) => row.id !== versionId,
    );
    // `on delete set null`: borrar el origen no se lleva por delante un
    // snapshot que ya es independiente.
    for (const row of tables.project_versions) {
      if (row.source_version_id === versionId) row.source_version_id = null;
    }
  }

  function deleteProject(projectId: unknown): void {
    for (const version of tables.project_versions.filter(
      (row) => row.project_id === projectId,
    )) {
      deleteVersion(version.id);
    }
    tables.projects = tables.projects.filter((row) => row.id !== projectId);
  }

  // ── RowStore ───────────────────────────────────────────────────────────

  const store: RowStore = {
    async select(table, options) {
      const rows = visible(table).filter((row) => matches(row, options?.where ?? []));
      return sortRows(rows, options?.order ?? []).map((row) => ({ ...row }));
    },

    async insert(table, values) {
      const stamp = nowIso();
      let row: Row;

      switch (table) {
        case "projects": {
          requireText(values.title, "El título", 1, 200);
          if (typeof values.description === "string" && values.description.length > 2000) {
            throw new ConflictError("check", "La descripción no puede pasar de 2000 caracteres.");
          }
          row = {
            id: nextId(),
            // La sesión, nunca el llamante. Es la razón por la que `ownerId` no
            // está en `NewProject`.
            owner_id: currentUserId(),
            title: values.title,
            description: values.description ?? null,
            created_at: stamp,
            updated_at: stamp,
          };
          break;
        }
        case "project_versions": {
          if (!ownsProject(values.project_id)) {
            throw new NotFoundError("el Proyecto", String(values.project_id));
          }
          if (values.label != null) requireText(values.label, "La etiqueta", 1, 120);
          row = {
            id: nextId(),
            project_id: values.project_id,
            version_number: nextVersionNumber(values.project_id),
            label: values.label ?? null,
            source_version_id: values.source_version_id ?? null,
            created_at: stamp,
            updated_at: stamp,
          };
          break;
        }
        case "nodes": {
          if (!ownsVersion(values.version_id)) {
            throw new NotFoundError("la Versión", String(values.version_id));
          }
          row = {
            id: nextId(),
            version_id: values.version_id,
            parent_id: values.parent_id ?? null,
            content: values.content ?? "",
            order_index: values.order_index ?? 0,
            created_at: stamp,
            updated_at: stamp,
          };
          assertParentSameVersion(row);
          break;
        }
        case "ai_analyses": {
          if (!ownsVersion(values.version_id)) {
            throw new NotFoundError("la Versión", String(values.version_id));
          }
          row = {
            id: nextId(),
            version_id: values.version_id,
            user_guidelines: values.user_guidelines ?? null,
            provider: values.provider,
            model: values.model,
            summary: values.summary,
            questions: values.questions ?? [],
            features: values.features ?? [],
            master_prompt: values.master_prompt,
            feature_prompts: values.feature_prompts ?? [],
            created_at: stamp,
          };
          break;
        }
      }

      tables[table].push(row);
      return { ...row };
    },

    async update(table, id, values) {
      const row = tables[table].find(
        (candidate) => candidate.id === id && isVisible(table, candidate),
      );
      if (!row) return null;

      const next: Row = { ...row, ...values };

      if (table === "projects" && "title" in values) {
        requireText(next.title, "El título", 1, 200);
      }
      if (table === "project_versions" && next.label != null) {
        requireText(next.label, "La etiqueta", 1, 120);
      }
      if (table === "nodes") {
        assertParentSameVersion(next);
      }
      // Un Análisis no se edita, así que la migración no le da política de
      // update: en el motor real un UPDATE toca cero filas y el núcleo lo
      // convierte en `NotFoundError`. Esto es lo mismo, dicho antes. El puerto
      // no ofrece la operación, así que no debería llegarse aquí nunca.
      if (table === "ai_analyses") {
        throw new NotFoundError("el Análisis", id);
      }

      next.updated_at = nowIso();
      Object.assign(row, next);
      return { ...row };
    },

    async delete(table, id) {
      const row = tables[table].find(
        (candidate) => candidate.id === id && isVisible(table, candidate),
      );
      if (!row) return false;

      if (table === "projects") deleteProject(id);
      else if (table === "project_versions") deleteVersion(id);
      else if (table === "nodes") deleteNodeSubtree(id);
      else tables.ai_analyses = tables.ai_analyses.filter((r) => r.id !== id);

      return true;
    },

    async cloneVersion(versionId, label) {
      const source = tables.project_versions.find(
        (row) => row.id === versionId && isVisible("project_versions", row),
      );
      // Lo mismo que hace la RPC con `security invoker`: clonar una Versión
      // ajena falla igual que leerla.
      if (!source) return null;

      const clone = await store.insert("project_versions", {
        project_id: source.project_id,
        label,
        source_version_id: source.id,
      });

      const remap = new Map<unknown, string>();
      const sourceNodes = tables.nodes.filter((row) => row.version_id === source.id);
      for (const node of sourceNodes) remap.set(node.id, nextId());

      const stamp = nowIso();
      for (const node of sourceNodes) {
        tables.nodes.push({
          id: remap.get(node.id) as string,
          version_id: clone.id,
          parent_id: node.parent_id == null ? null : (remap.get(node.parent_id) ?? null),
          content: node.content,
          order_index: node.order_index,
          created_at: stamp,
          updated_at: stamp,
        });
      }

      // Los Análisis no se clonan: pertenecen a la Versión que los generó.
      return clone;
    },
  };

  // ── Autenticación ──────────────────────────────────────────────────────

  function toSession(user: StoredUser): AuthSession {
    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        // El doble no simula proveedores sociales: aquí nadie tiene foto.
        name: null,
        image: null,
      },
    };
  }

  const auth: AuthProvider = {
    async currentSession() {
      return session ? toSession(session) : null;
    },

    async requireSession() {
      if (!session) throw new UnauthenticatedError();
      return toSession(session);
    },

    async signUpWithEmail({ email, password }) {
      if (users.has(email)) {
        throw new ConflictError("email-registrado", "Ese email ya tiene cuenta.");
      }
      users.set(email, { id: nextId(), email, password, emailVerified: false });
      // El spec exige verificación obligatoria, así que registrarse nunca deja
      // sesión abierta.
      return { needsEmailVerification: true };
    },

    async signInWithEmail({ email, password }) {
      const user = users.get(email);
      if (!user || user.password !== password) {
        throw new UnauthenticatedError("Email o contraseña incorrectos.");
      }
      if (!user.emailVerified) {
        throw new UnauthenticatedError("Confirma tu email antes de entrar.");
      }
      session = user;
      return toSession(user);
    },

    async signInWithGoogle() {
      throw new UnauthenticatedError(
        "El adaptador en memoria no habla con Google: no hay a dónde redirigir.",
      );
    },

    async signOut() {
      session = null;
    },
  };

  return {
    name: "in-memory",
    auth,
    ...createRepositories(store),

    verifyEmail(email) {
      const user = users.get(email);
      if (!user) throw new NotFoundError("la cuenta", email);
      user.emailVerified = true;
    },

    reset() {
      users.clear();
      session = null;
      tables = { projects: [], project_versions: [], nodes: [], ai_analyses: [] };
    },
  };
}
