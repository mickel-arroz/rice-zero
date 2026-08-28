/**
 * La capa de servicios de Nodos, contra el adaptador en memoria.
 *
 * Mismo criterio que `projects.test.ts`: el doble implementa el mismo
 * `RowStore` que Neon y Supabase, así que aquí se ejercita el núcleo
 * compartido de verdad —RLS incluida— y no un mock que dice sí a todo.
 *
 * Lo que NO se comprueba aquí son las reglas del árbol en sí: viven en
 * `lib/tree` y se comprueban sin backend. Aquí se comprueba que el servicio
 * las aplica ANTES de escribir y que traduce un rechazo a `ConflictError`.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  ConflictError,
  NotFoundError,
  type BackendProvider,
  type Project,
  type ProjectVersion,
} from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import { createNodeService, type NodeService } from "@/lib/services/nodes";

describe("capa de servicios: Nodos", () => {
  let backend: InMemoryBackend;
  let nodes: NodeService;
  let project: Project;
  let version: ProjectVersion;

  const PASSWORD = "contraseña-larga";

  /** Da de alta la cuenta, la confirma y entra. Para la PRIMERA vez. */
  async function signUp(email: string): Promise<void> {
    await backend.auth.signUpWithEmail({ email, password: PASSWORD });
    backend.verifyEmail(email);
    await signIn(email);
  }

  /** Vuelve a entrar con una cuenta que ya existe. */
  async function signIn(email: string): Promise<void> {
    await backend.auth.signInWithEmail({ email, password: PASSWORD });
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await signUp("tu@correo.com");
    nodes = createNodeService(backend as BackendProvider);
    project = await backend.projects.create({ title: "Tienda online" });
    [version] = await backend.versions.listByProject(project.id);
  });

  /** El árbol de la Versión activa, en ids, tal y como quedó guardado. */
  async function ids(): Promise<string[]> {
    return (await nodes.list(version.id)).map((node) => node.id);
  }

  describe("crear", () => {
    it("una Versión admite varias raíces", async () => {
      await nodes.createRoot(version.id, "Primera idea");
      await nodes.createRoot(version.id, "Segunda idea");

      const tree = await nodes.tree(version.id);
      expect(tree.map((root) => root.node.content)).toEqual([
        "Primera idea",
        "Segunda idea",
      ]);
    });

    it("cada raíz nueva se pone la última", async () => {
      const primera = await nodes.createRoot(version.id, "Primera");
      const segunda = await nodes.createRoot(version.id, "Segunda");

      expect([primera.orderIndex, segunda.orderIndex]).toEqual([0, 1]);
    });

    it("un subnodo cuelga de su padre y se pone el último", async () => {
      const raiz = await nodes.createRoot(version.id, "Raíz");
      await nodes.createChild(version.id, raiz.id, "Primero");
      const segundo = await nodes.createChild(version.id, raiz.id, "Segundo");

      expect(segundo.parentId).toBe(raiz.id);
      expect(segundo.orderIndex).toBe(1);
    });

    it("todo Nodo puede tener hijos, sin límite de profundidad", async () => {
      const raiz = await nodes.createRoot(version.id, "Nivel 1");
      const hijo = await nodes.createChild(version.id, raiz.id, "Nivel 2");
      const nieto = await nodes.createChild(version.id, hijo.id, "Nivel 3");

      expect(nieto.parentId).toBe(hijo.id);
    });

    it("un Nodo nace vacío si no se le da texto", async () => {
      expect((await nodes.createRoot(version.id)).content).toBe("");
    });

    it("rechaza colgar de un padre que no está en la Versión", async () => {
      const otra = await backend.versions.create({ projectId: project.id });
      const ajeno = await nodes.createRoot(otra.id, "De otra Versión");

      await expect(
        nodes.createChild(version.id, ajeno.id, "Imposible"),
      ).rejects.toThrow(ConflictError);
    });

    it("un padre inválido no llega a escribir nada", async () => {
      await nodes
        .createChild(version.id, "00000000-0000-4000-8000-999999999999", "Nada")
        .catch(() => {});

      expect(await ids()).toEqual([]);
    });

    it("no deja escribir en la Versión de otro", async () => {
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      await expect(nodes.createRoot(version.id, "Intruso")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("editar el texto", () => {
    it("guarda lo que se escribe", async () => {
      const raiz = await nodes.createRoot(version.id, "Antes");

      expect((await nodes.edit(raiz.id, "Después")).content).toBe("Después");
    });

    it("no recorta: el autoguardado manda el texto tal cual se teclea", async () => {
      const raiz = await nodes.createRoot(version.id, "");

      expect((await nodes.edit(raiz.id, "Sin terminar ")).content).toBe(
        "Sin terminar ",
      );
    });

    it("editar un Nodo que no existe no existe", async () => {
      await expect(
        nodes.edit("00000000-0000-4000-8000-999999999999", "Nada"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("re-parentar", () => {
    /** Dos raíces, tres niveles: la forma con la que se prueban las reglas. */
    async function seed() {
      const a = await nodes.createRoot(version.id, "A");
      const a1 = await nodes.createChild(version.id, a.id, "A1");
      const a1x = await nodes.createChild(version.id, a1.id, "A1X");
      const b = await nodes.createRoot(version.id, "B");
      return { a, a1, a1x, b };
    }

    it("mueve un Nodo bajo otro padre", async () => {
      const { a1, b } = await seed();

      expect((await nodes.reparent(version.id, a1.id, b.id)).parentId).toBe(b.id);
    });

    it("se lleva su subárbol con él", async () => {
      const { a1, a1x, b } = await seed();

      await nodes.reparent(version.id, a1.id, b.id);

      const tree = await nodes.tree(version.id);
      const raizB = tree.find((root) => root.node.id === b.id);
      expect(raizB?.children[0].children.map((c) => c.node.id)).toEqual([a1x.id]);
    });

    it("suelta un Nodo como raíz", async () => {
      const { a1 } = await seed();

      expect((await nodes.reparent(version.id, a1.id, null)).parentId).toBeNull();
    });

    it("aterriza el último de sus hermanos nuevos", async () => {
      const { a1, b } = await seed();
      await nodes.createChild(version.id, b.id, "B1");

      expect((await nodes.reparent(version.id, a1.id, b.id)).orderIndex).toBe(1);
    });

    it("rechaza colgar un Nodo de sí mismo", async () => {
      const { a } = await seed();

      await expect(nodes.reparent(version.id, a.id, a.id)).rejects.toThrow(
        ConflictError,
      );
    });

    it("rechaza colgar un Nodo de un hijo suyo", async () => {
      const { a, a1 } = await seed();

      await expect(nodes.reparent(version.id, a.id, a1.id)).rejects.toThrow(
        ConflictError,
      );
    });

    it("rechaza colgar un Nodo de un descendiente lejano", async () => {
      const { a, a1x } = await seed();

      await expect(nodes.reparent(version.id, a.id, a1x.id)).rejects.toThrow(
        ConflictError,
      );
    });

    it("un movimiento inválido no llega a escribir nada", async () => {
      const { a, a1 } = await seed();

      await nodes.reparent(version.id, a.id, a1.id).catch(() => {});

      const raices = await nodes.tree(version.id);
      expect(raices.map((root) => root.node.id)).toContain(a.id);
    });

    it("soltarlo sobre el padre que ya tenía no lo mueve de sitio", async () => {
      const { a, a1 } = await seed();
      await nodes.createChild(version.id, a.id, "A2");

      // Un arrastre que acaba donde empezó. Si esto reescribiera el orden, el
      // Nodo saltaría al final de sus hermanos por no haber hecho nada.
      const quieto = await nodes.reparent(version.id, a1.id, a.id);

      expect(quieto.orderIndex).toBe(0);
      expect(quieto.parentId).toBe(a.id);
    });

    it("soltar una raíz sobre la nada tampoco la mueve", async () => {
      const { a } = await seed();

      expect((await nodes.reparent(version.id, a.id, null)).orderIndex).toBe(0);
    });

    it("rechaza un destino de otra Versión", async () => {
      const { a1 } = await seed();
      const otra = await backend.versions.create({ projectId: project.id });
      const ajeno = await nodes.createRoot(otra.id, "De otra Versión");

      await expect(
        nodes.reparent(version.id, a1.id, ajeno.id),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("reordenar", () => {
    async function seedSiblings() {
      const uno = await nodes.createRoot(version.id, "Uno");
      const dos = await nodes.createRoot(version.id, "Dos");
      const tres = await nodes.createRoot(version.id, "Tres");
      return { uno, dos, tres };
    }

    it("sube un Nodo entre sus hermanos", async () => {
      const { uno, dos, tres } = await seedSiblings();

      await nodes.reorder(version.id, tres.id, 0);

      expect(await ids()).toEqual([tres.id, uno.id, dos.id]);
    });

    it("baja un Nodo entre sus hermanos", async () => {
      const { uno, dos, tres } = await seedSiblings();

      await nodes.reorder(version.id, uno.id, 2);

      expect(await ids()).toEqual([dos.id, tres.id, uno.id]);
    });

    it("un destino fuera de rango deja el Nodo en el extremo", async () => {
      const { uno, dos, tres } = await seedSiblings();

      await nodes.reorder(version.id, uno.id, 99);

      expect(await ids()).toEqual([dos.id, tres.id, uno.id]);
    });

    it("deja los índices densos", async () => {
      const { tres } = await seedSiblings();

      await nodes.reorder(version.id, tres.id, 0);

      expect((await nodes.list(version.id)).map((n) => n.orderIndex)).toEqual([
        0, 1, 2,
      ]);
    });

    it("no toca a los Nodos de otro padre", async () => {
      const raiz = await nodes.createRoot(version.id, "Raíz");
      const hijo = await nodes.createChild(version.id, raiz.id, "Hijo");
      const { tres } = await seedSiblings();

      await nodes.reorder(version.id, tres.id, 0);

      const guardado = (await nodes.list(version.id)).find((n) => n.id === hijo.id);
      expect(guardado?.orderIndex).toBe(0);
    });
  });

  describe("serializar para la IA", () => {
    it("da el árbol guardado como texto", async () => {
      const raiz = await nodes.createRoot(version.id, "Tienda online");
      await nodes.createChild(version.id, raiz.id, "Catálogo");

      expect(await nodes.serialize(version.id)).toBe(
        "- Tienda online\n  - Catálogo",
      );
    });
  });

  /**
   * La RLS, función por función.
   *
   * Está entero y no en un caso suelto porque el criterio de aceptación pide
   * el contrato «ante éxito, error y denegación RLS», y un contrato que solo
   * se comprueba en una de las diez operaciones no es un contrato: es una
   * anécdota. Lo que se fija aquí es que la denegación tenga UNA forma —la
   * misma que «no existe»— y no tres según por dónde se entre.
   */
  describe("la Versión de otro", () => {
    let ajena: ProjectVersion;
    let nodoAjeno: string;

    beforeEach(async () => {
      const raiz = await nodes.createRoot(version.id, "Mío");
      await nodes.createChild(version.id, raiz.id, "También mío");
      ajena = version;
      nodoAjeno = raiz.id;

      await backend.auth.signOut();
      await signUp("otra@correo.com");
    });

    it("no la deja leer: para el intruso está vacía", async () => {
      expect(await nodes.list(ajena.id)).toEqual([]);
      expect(await nodes.tree(ajena.id)).toEqual([]);
      expect(await nodes.serialize(ajena.id)).toBe("");
      expect(await nodes.countDescendants(ajena.id, nodoAjeno)).toBe(0);
    });

    it("no la deja escribir, y siempre con el mismo fallo", async () => {
      await expect(nodes.createRoot(ajena.id, "Intruso")).rejects.toThrow(
        NotFoundError,
      );
      await expect(nodes.edit(nodoAjeno, "Intruso")).rejects.toThrow(NotFoundError);
      await expect(nodes.remove(nodoAjeno)).rejects.toThrow(NotFoundError);
      await expect(
        nodes.reparent(ajena.id, nodoAjeno, null),
      ).rejects.toThrow(NotFoundError);
      // El que más se escapaba: sin Nodo visible el plan sale vacío, el bucle
      // no da una vuelta y la denegación acabaría diciendo «hecho».
      await expect(nodes.reorder(ajena.id, nodoAjeno, 0)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("un intento denegado no toca el árbol del dueño", async () => {
      await nodes.remove(nodoAjeno).catch(() => {});
      await nodes.reorder(ajena.id, nodoAjeno, 5).catch(() => {});

      await backend.auth.signOut();
      await signIn("tu@correo.com");
      expect(await nodes.list(ajena.id)).toHaveLength(2);
    });
  });

  describe("borrar", () => {
    it("dice cuántos caen antes de borrar", async () => {
      const raiz = await nodes.createRoot(version.id, "Raíz");
      const hijo = await nodes.createChild(version.id, raiz.id, "Hijo");
      await nodes.createChild(version.id, hijo.id, "Nieto");

      expect(await nodes.countDescendants(version.id, raiz.id)).toBe(2);
    });

    it("se lleva el subárbol entero", async () => {
      const raiz = await nodes.createRoot(version.id, "Raíz");
      const hijo = await nodes.createChild(version.id, raiz.id, "Hijo");
      await nodes.createChild(version.id, hijo.id, "Nieto");
      const superviviente = await nodes.createRoot(version.id, "Otro subárbol");

      await nodes.remove(raiz.id);

      expect(await ids()).toEqual([superviviente.id]);
    });
  });
});
