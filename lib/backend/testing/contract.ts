/**
 * La contract suite del Proveedor de Backend.
 *
 * Una sola, compartida por todos los adaptadores. Lo que dice es «esto es lo
 * que significa ser un Proveedor de Backend de RICE(0)», así que un adaptador
 * nuevo se considera terminado cuando la pasa entera y no antes.
 *
 * Solo habla el vocabulario del puerto: entidades de dominio y la taxonomía de
 * errores. Si un test de aquí necesitara saber de tablas, de filas o de
 * PostgREST, el puerto estaría mal.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  ConflictError,
  NotFoundError,
  type BackendProvider,
  type Project,
  type ProjectVersion,
} from "@/lib/backend/ports";

export type BackendContractHarness = {
  /** Nombre del adaptador, para el nombre del `describe`. */
  name: string;
  /**
   * Deja un proveedor con sesión abierta y lista para escribir.
   *
   * Contra un backend real esto incluye la cuenta ya verificada: el puerto
   * exige verificación de email para entrar, y la contract suite no es el sitio
   * donde probar eso.
   */
  setUp(): Promise<BackendProvider>;
  /** Borra lo que el bloque anterior haya creado. */
  tearDown(backend: BackendProvider): Promise<void>;
};

export function describeBackendContract(harness: BackendContractHarness): void {
  describe(`Proveedor de Backend: ${harness.name}`, () => {
    let backend: BackendProvider;

    /** Un Proyecto con su primera Versión, que es el estado de partida real. */
    async function seedProject(): Promise<{
      project: Project;
      version: ProjectVersion;
    }> {
      const project = await backend.projects.create({ title: "Proyecto de prueba" });
      const version = await backend.versions.create({ projectId: project.id });
      return { project, version };
    }

    beforeEach(async () => {
      if (backend) await harness.tearDown(backend);
      backend = await harness.setUp();
    });

    describe("sesión", () => {
      it("hay una sesión abierta con el email verificado", async () => {
        const session = await backend.auth.requireSession();
        expect(session.user.id).toBeTruthy();
        expect(session.user.emailVerified).toBe(true);
      });
    });

    describe("Proyectos", () => {
      it("crea un Proyecto y lo devuelve como entidad de dominio", async () => {
        const project = await backend.projects.create({
          title: "Mi idea",
          description: "Dos líneas.",
        });

        expect(project.id).toBeTruthy();
        expect(project.title).toBe("Mi idea");
        expect(project.description).toBe("Dos líneas.");
        // `camelCase` y `Date`, no filas: es el contrato del puerto.
        expect(project.createdAt).toBeInstanceOf(Date);
        expect(project.updatedAt).toBeInstanceOf(Date);
      });

      it("atribuye el Proyecto a la sesión, sin que nadie mande el dueño", async () => {
        const session = await backend.auth.requireSession();
        const project = await backend.projects.create({ title: "Mi idea" });

        expect(project.ownerId).toBe(session.user.id);
      });

      it("deja la descripción nula cuando no se manda", async () => {
        const project = await backend.projects.create({ title: "Sin descripción" });

        expect(project.description).toBeNull();
      });

      it("lista los Proyectos del usuario", async () => {
        await backend.projects.create({ title: "Primero" });
        await backend.projects.create({ title: "Segundo" });

        const titles = (await backend.projects.list()).map((p) => p.title);
        expect(titles).toContain("Primero");
        expect(titles).toContain("Segundo");
      });

      it("recupera un Proyecto por id", async () => {
        const created = await backend.projects.create({ title: "Buscado" });

        expect((await backend.projects.get(created.id)).title).toBe("Buscado");
      });

      it("actualiza solo los campos que le mandan", async () => {
        const created = await backend.projects.create({
          title: "Antes",
          description: "Se queda.",
        });

        const updated = await backend.projects.update(created.id, { title: "Después" });

        expect(updated.title).toBe("Después");
        expect(updated.description).toBe("Se queda.");
      });

      it("distingue «no lo toques» de «ponlo a nulo»", async () => {
        const created = await backend.projects.create({
          title: "Con descripción",
          description: "Se va.",
        });

        const updated = await backend.projects.update(created.id, { description: null });

        expect(updated.description).toBeNull();
      });

      it("borra un Proyecto", async () => {
        const created = await backend.projects.create({ title: "Efímero" });

        await backend.projects.delete(created.id);

        await expect(backend.projects.get(created.id)).rejects.toThrow(NotFoundError);
      });

      it("se lleva las Versiones del Proyecto al borrarlo", async () => {
        const { project, version } = await seedProject();

        await backend.projects.delete(project.id);

        await expect(backend.versions.get(version.id)).rejects.toThrow(NotFoundError);
      });

      it("un Proyecto que no existe es NotFoundError, no un null", async () => {
        await expect(backend.projects.get(MISSING_ID)).rejects.toThrow(NotFoundError);
        await expect(
          backend.projects.update(MISSING_ID, { title: "Nada" }),
        ).rejects.toThrow(NotFoundError);
        await expect(backend.projects.delete(MISSING_ID)).rejects.toThrow(NotFoundError);
      });

      it("rechaza un título vacío", async () => {
        await expect(backend.projects.create({ title: "   " })).rejects.toThrow(
          ConflictError,
        );
      });
    });

    describe("Versiones", () => {
      it("numera la primera Versión de un Proyecto como la 1", async () => {
        const { version } = await seedProject();

        expect(version.versionNumber).toBe(1);
      });

      it("numera de forma densa y monótona por Proyecto", async () => {
        const { project } = await seedProject();

        const second = await backend.versions.create({ projectId: project.id });
        const third = await backend.versions.create({ projectId: project.id });

        expect([second.versionNumber, third.versionNumber]).toEqual([2, 3]);
      });

      it("normaliza una etiqueta en blanco a «sin etiqueta»", async () => {
        const { project } = await seedProject();

        const version = await backend.versions.create({
          projectId: project.id,
          label: "   ",
        });

        expect(version.label).toBeNull();
      });

      it("recorta los espacios de la etiqueta", async () => {
        const { project } = await seedProject();

        const version = await backend.versions.create({
          projectId: project.id,
          label: "  Rumbo B  ",
        });

        expect(version.label).toBe("Rumbo B");
      });

      it("lista las Versiones de un Proyecto de la más nueva a la más vieja", async () => {
        const { project } = await seedProject();
        await backend.versions.create({ projectId: project.id });

        const numbers = (await backend.versions.listByProject(project.id)).map(
          (v) => v.versionNumber,
        );

        expect(numbers).toEqual([2, 1]);
      });

      it("renombra una Versión", async () => {
        const { version } = await seedProject();

        const renamed = await backend.versions.rename(version.id, "  Otro rumbo ");

        expect(renamed.label).toBe("Otro rumbo");
      });

      it("quita la etiqueta cuando se renombra a nulo", async () => {
        const { project } = await seedProject();
        const version = await backend.versions.create({
          projectId: project.id,
          label: "Temporal",
        });

        expect((await backend.versions.rename(version.id, null)).label).toBeNull();
      });

      it("borra una Versión cuando no es la última", async () => {
        const { project, version } = await seedProject();
        await backend.versions.create({ projectId: project.id });

        await backend.versions.delete(version.id);

        await expect(backend.versions.get(version.id)).rejects.toThrow(NotFoundError);
      });

      it("no deja a un Proyecto sin Versiones", async () => {
        const { version } = await seedProject();

        await expect(backend.versions.delete(version.id)).rejects.toThrow(ConflictError);
        // Y sigue ahí: el error no es un aviso, es un rechazo.
        expect((await backend.versions.get(version.id)).id).toBe(version.id);
      });

      it("una Versión que no existe es NotFoundError", async () => {
        await expect(backend.versions.get(MISSING_ID)).rejects.toThrow(NotFoundError);
        await expect(backend.versions.rename(MISSING_ID, "x")).rejects.toThrow(
          NotFoundError,
        );
        await expect(backend.versions.delete(MISSING_ID)).rejects.toThrow(NotFoundError);
        await expect(backend.versions.clone(MISSING_ID)).rejects.toThrow(NotFoundError);
      });

      it("no crea una Versión en un Proyecto que no es tuyo", async () => {
        await expect(
          backend.versions.create({ projectId: MISSING_ID }),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe("Nodos", () => {
      it("crea un Nodo raíz con los valores por defecto del esquema", async () => {
        const { version } = await seedProject();

        const node = await backend.nodes.create({ versionId: version.id });

        expect(node.parentId).toBeNull();
        expect(node.content).toBe("");
        expect(node.orderIndex).toBe(0);
      });

      it("cuelga un Nodo de otro", async () => {
        const { version } = await seedProject();
        const root = await backend.nodes.create({ versionId: version.id, content: "Raíz" });

        const child = await backend.nodes.create({
          versionId: version.id,
          parentId: root.id,
          content: "Hijo",
        });

        expect(child.parentId).toBe(root.id);
      });

      it("devuelve el árbol con las raíces antes que los hijos y ordenado entre hermanos", async () => {
        const { version } = await seedProject();
        const root = await backend.nodes.create({ versionId: version.id, content: "Raíz" });
        await backend.nodes.create({
          versionId: version.id,
          parentId: root.id,
          content: "Segundo",
          orderIndex: 1,
        });
        await backend.nodes.create({
          versionId: version.id,
          parentId: root.id,
          content: "Primero",
          orderIndex: 0,
        });

        const contents = (await backend.nodes.listByVersion(version.id)).map(
          (n) => n.content,
        );

        expect(contents).toEqual(["Raíz", "Primero", "Segundo"]);
      });

      it("edita el contenido de un Nodo", async () => {
        const { version } = await seedProject();
        const node = await backend.nodes.create({ versionId: version.id, content: "Antes" });

        expect((await backend.nodes.update(node.id, { content: "Después" })).content).toBe(
          "Después",
        );
      });

      it("re-parenta un Nodo", async () => {
        const { version } = await seedProject();
        const first = await backend.nodes.create({ versionId: version.id, content: "A" });
        const second = await backend.nodes.create({ versionId: version.id, content: "B" });

        expect((await backend.nodes.update(second.id, { parentId: first.id })).parentId).toBe(
          first.id,
        );
      });

      it("devuelve un Nodo a raíz", async () => {
        const { version } = await seedProject();
        const root = await backend.nodes.create({ versionId: version.id, content: "A" });
        const child = await backend.nodes.create({
          versionId: version.id,
          parentId: root.id,
          content: "B",
        });

        expect((await backend.nodes.update(child.id, { parentId: null })).parentId).toBeNull();
      });

      it("se lleva el subárbol al borrar un Nodo", async () => {
        const { version } = await seedProject();
        const root = await backend.nodes.create({ versionId: version.id, content: "Raíz" });
        await backend.nodes.create({
          versionId: version.id,
          parentId: root.id,
          content: "Hijo",
        });

        await backend.nodes.delete(root.id);

        expect(await backend.nodes.listByVersion(version.id)).toEqual([]);
      });

      it("no cuelga un Nodo de un padre de otra Versión", async () => {
        const { project, version } = await seedProject();
        const other = await backend.versions.create({ projectId: project.id });
        const foreignRoot = await backend.nodes.create({
          versionId: other.id,
          content: "De la otra Versión",
        });

        await expect(
          backend.nodes.create({
            versionId: version.id,
            parentId: foreignRoot.id,
            content: "Cruzado",
          }),
        ).rejects.toThrow(ConflictError);
      });

      it("un Nodo que no existe es NotFoundError", async () => {
        await expect(backend.nodes.update(MISSING_ID, { content: "x" })).rejects.toThrow(
          NotFoundError,
        );
        await expect(backend.nodes.delete(MISSING_ID)).rejects.toThrow(NotFoundError);
      });

      it("no crea un Nodo en una Versión que no es tuya", async () => {
        await expect(backend.nodes.create({ versionId: MISSING_ID })).rejects.toThrow(
          NotFoundError,
        );
      });
    });

    describe("clonar una Versión", () => {
      /** Raíz 1 → Hijo 1.1 → Nieto, más Hijo 1.2 y Raíz 2. */
      async function seedTree(versionId: string) {
        const root1 = await backend.nodes.create({ versionId, content: "Raíz 1" });
        const child11 = await backend.nodes.create({
          versionId,
          parentId: root1.id,
          content: "Hijo 1.1",
        });
        await backend.nodes.create({
          versionId,
          parentId: child11.id,
          content: "Nieto 1.1.1",
        });
        await backend.nodes.create({
          versionId,
          parentId: root1.id,
          content: "Hijo 1.2",
          orderIndex: 1,
        });
        await backend.nodes.create({ versionId, content: "Raíz 2", orderIndex: 1 });
      }

      it("apunta a su Versión de origen y toma el siguiente número", async () => {
        const { version } = await seedProject();

        const clone = await backend.versions.clone(version.id, "  Rumbo B  ");

        expect(clone.sourceVersionId).toBe(version.id);
        expect(clone.versionNumber).toBe(2);
        expect(clone.label).toBe("Rumbo B");
      });

      it("copia el árbol entero y deja el original intacto", async () => {
        const { version } = await seedProject();
        await seedTree(version.id);

        const clone = await backend.versions.clone(version.id);

        expect(await backend.nodes.listByVersion(clone.id)).toHaveLength(5);
        expect(await backend.nodes.listByVersion(version.id)).toHaveLength(5);
      });

      it("no comparte ni un Nodo con el original", async () => {
        const { version } = await seedProject();
        await seedTree(version.id);

        const clone = await backend.versions.clone(version.id);

        const originalIds = new Set(
          (await backend.nodes.listByVersion(version.id)).map((n) => n.id),
        );
        const cloneIds = (await backend.nodes.listByVersion(clone.id)).map((n) => n.id);

        expect(cloneIds.filter((id) => originalIds.has(id))).toEqual([]);
      });

      it("remapea la jerarquía dentro del clon", async () => {
        const { version } = await seedProject();
        await seedTree(version.id);

        const clone = await backend.versions.clone(version.id);
        const nodes = await backend.nodes.listByVersion(clone.id);
        const byId = new Map(nodes.map((n) => [n.id, n]));

        // Ningún padre apunta fuera del clon.
        for (const node of nodes) {
          if (node.parentId !== null) expect(byId.has(node.parentId)).toBe(true);
        }
        // Y la cadena Raíz 1 → Hijo 1.1 → Nieto sobrevivió.
        const grandchild = nodes.find((n) => n.content === "Nieto 1.1.1");
        const child = byId.get(grandchild?.parentId ?? "");
        const root = byId.get(child?.parentId ?? "");
        expect(child?.content).toBe("Hijo 1.1");
        expect(root?.content).toBe("Raíz 1");
        expect(root?.parentId).toBeNull();
      });

      it("conserva la forma del árbol y el orden entre hermanos", async () => {
        const { version } = await seedProject();
        await seedTree(version.id);

        const clone = await backend.versions.clone(version.id);
        const nodes = await backend.nodes.listByVersion(clone.id);

        expect(nodes.filter((n) => n.parentId === null)).toHaveLength(2);
        expect(nodes.find((n) => n.content === "Hijo 1.2")?.orderIndex).toBe(1);
      });

      it("no arrastra los Análisis: pertenecen a la Versión que los generó", async () => {
        const { version } = await seedProject();
        await backend.analyses.create({
          versionId: version.id,
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          masterPrompt: "Master Prompt",
        });

        const clone = await backend.versions.clone(version.id);

        expect(await backend.analyses.listByVersion(clone.id)).toEqual([]);
      });
    });

    describe("Análisis", () => {
      it("guarda un Análisis con los campos de la IA", async () => {
        const { version } = await seedProject();

        const analysis = await backend.analyses.create({
          versionId: version.id,
          userGuidelines: "Sé breve.",
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          questions: ["¿Quién lo usa?"],
          features: [{ name: "Login", description: "Entrar." }],
          masterPrompt: "Master Prompt",
          featurePrompts: [{ name: "Login", prompt: "Implementa login." }],
        });

        expect(analysis.userGuidelines).toBe("Sé breve.");
        expect(analysis.questions).toEqual(["¿Quién lo usa?"]);
        expect(analysis.features).toEqual([{ name: "Login", description: "Entrar." }]);
        expect(analysis.featurePrompts).toEqual([
          { name: "Login", prompt: "Implementa login." },
        ]);
        expect(analysis.createdAt).toBeInstanceOf(Date);
      });

      it("deja los campos de IA vacíos cuando no se mandan", async () => {
        const { version } = await seedProject();

        const analysis = await backend.analyses.create({
          versionId: version.id,
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          masterPrompt: "Master Prompt",
        });

        expect(analysis.questions).toEqual([]);
        expect(analysis.features).toEqual([]);
        expect(analysis.featurePrompts).toEqual([]);
        expect(analysis.userGuidelines).toBeNull();
      });

      it("lista los Análisis de una Versión y recupera uno por id", async () => {
        const { version } = await seedProject();
        const created = await backend.analyses.create({
          versionId: version.id,
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          masterPrompt: "Master Prompt",
        });

        expect((await backend.analyses.listByVersion(version.id)).map((a) => a.id)).toEqual([
          created.id,
        ]);
        expect((await backend.analyses.get(created.id)).summary).toBe("Resumen");
      });

      it("borra un Análisis", async () => {
        const { version } = await seedProject();
        const created = await backend.analyses.create({
          versionId: version.id,
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          masterPrompt: "Master Prompt",
        });

        await backend.analyses.delete(created.id);

        await expect(backend.analyses.get(created.id)).rejects.toThrow(NotFoundError);
      });

      it("se lleva los Análisis al borrar la Versión", async () => {
        const { project, version } = await seedProject();
        await backend.versions.create({ projectId: project.id });
        const created = await backend.analyses.create({
          versionId: version.id,
          provider: "gemini",
          model: "modelo-de-prueba",
          summary: "Resumen",
          masterPrompt: "Master Prompt",
        });

        await backend.versions.delete(version.id);

        await expect(backend.analyses.get(created.id)).rejects.toThrow(NotFoundError);
      });

      it("un Análisis que no existe es NotFoundError", async () => {
        await expect(backend.analyses.get(MISSING_ID)).rejects.toThrow(NotFoundError);
        await expect(backend.analyses.delete(MISSING_ID)).rejects.toThrow(NotFoundError);
      });
    });
  });
}

/**
 * Un uuid con la forma correcta que no le pertenece a nadie.
 *
 * Es el mismo caso que un id ajeno: bajo RLS «no existe» y «no es tuyo» son
 * cero filas, y por eso el puerto los reporta igual.
 */
const MISSING_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
