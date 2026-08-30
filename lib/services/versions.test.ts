/**
 * La capa de servicios de Versiones, contra el adaptador en memoria.
 *
 * Mismo criterio que `nodes.test.ts`: el doble implementa el mismo `RowStore`
 * que Neon y Supabase, RLS incluida, así que «no es tuyo» se comprueba de
 * verdad y no contra un mock que dice que sí.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  ConflictError,
  NotFoundError,
  type BackendProvider,
  type Project,
} from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import {
  createVersionService,
  VERSION_ERRORS,
  VERSION_LIMITS,
  type VersionService,
} from "@/lib/services/versions";

describe("capa de servicios: Versiones", () => {
  let backend: InMemoryBackend;
  let versions: VersionService;
  let project: Project;

  const PASSWORD = "contraseña-larga";
  const MISSING = "00000000-0000-4000-8000-999999999999";

  async function signUp(email: string): Promise<void> {
    await backend.auth.signUpWithEmail({ email, password: PASSWORD });
    backend.verifyEmail(email);
    await backend.auth.signInWithEmail({ email, password: PASSWORD });
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await signUp("tu@correo.com");
    versions = createVersionService(backend as BackendProvider);
    project = await backend.projects.create({ title: "Tienda online" });
  });

  describe("cuál estoy editando", () => {
    it("todo Proyecto nace con una Versión, y esa es la activa", async () => {
      const active = await versions.active(project.id);

      expect(active.projectId).toBe(project.id);
      expect(active.versionNumber).toBe(1);
    });

    it("la activa es la más reciente", async () => {
      const segunda = await backend.versions.create({
        projectId: project.id,
        label: "Con pagos",
      });

      expect((await versions.active(project.id)).id).toBe(segunda.id);
    });

    it("un Proyecto que no es tuyo no tiene Versión activa", async () => {
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      await expect(versions.active(project.id)).rejects.toThrow(NotFoundError);
    });

    it("un Proyecto que no existe tampoco", async () => {
      await expect(versions.active(MISSING)).rejects.toThrow(NotFoundError);
    });
  });

  describe("listar", () => {
    it("las devuelve de la más nueva a la más vieja", async () => {
      await backend.versions.create({ projectId: project.id, label: "Rumbo B" });
      await backend.versions.create({ projectId: project.id, label: "Con pagos" });

      const listadas = await versions.list(project.id);

      expect(listadas.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
    });

    it("las de otro no se ven", async () => {
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      expect(await versions.list(project.id)).toEqual([]);
    });

    /**
     * Lo que hace de `list` el validador de la URL: la Versión de otro
     * Proyecto NO está aquí, así que la pantalla la trata como inexistente sin
     * necesidad de preguntar por ella aparte.
     */
    it("no se mezcla con las de otro Proyecto tuyo", async () => {
      const otroProyecto = await backend.projects.create({ title: "Blog" });
      const ajena = await versions.active(otroProyecto.id);

      const listadas = await versions.list(project.id);

      expect(listadas.map((v) => v.id)).not.toContain(ajena.id);
    });
  });

  describe("clonar", () => {
    it("el clon es un árbol idéntico e independiente", async () => {
      const origen = await versions.active(project.id);
      const raiz = await backend.nodes.create({
        versionId: origen.id,
        content: "Checkout",
      });
      await backend.nodes.create({
        versionId: origen.id,
        parentId: raiz.id,
        content: "Pasarela",
      });

      const clon = await versions.clone(origen.id, "Rumbo B");
      const copiados = await backend.nodes.listByVersion(clon.id);

      expect(clon.sourceVersionId).toBe(origen.id);
      expect(clon.label).toBe("Rumbo B");
      expect(copiados.map((n) => n.content).sort()).toEqual(["Checkout", "Pasarela"]);
      // Ni un id en común: es un snapshot, no una vista del mismo árbol.
      expect(copiados.map((n) => n.id)).not.toContain(raiz.id);
    });

    it("editar el clon no toca el origen", async () => {
      const origen = await versions.active(project.id);
      await backend.nodes.create({ versionId: origen.id, content: "Checkout" });

      const clon = await versions.clone(origen.id);
      const [copiado] = await backend.nodes.listByVersion(clon.id);
      await backend.nodes.update(copiado!.id, { content: "Otra cosa" });

      const [original] = await backend.nodes.listByVersion(origen.id);
      expect(original!.content).toBe("Checkout");
    });

    it("una etiqueta en blanco es lo mismo que no ponerle ninguna", async () => {
      const origen = await versions.active(project.id);

      expect((await versions.clone(origen.id, "   ")).label).toBeNull();
    });

    it("recorta los espacios de la etiqueta", async () => {
      const origen = await versions.active(project.id);

      expect((await versions.clone(origen.id, "  Rumbo B  ")).label).toBe("Rumbo B");
    });

    it("rechaza una etiqueta que no cabe, antes de escribir nada", async () => {
      const origen = await versions.active(project.id);
      const antes = (await versions.list(project.id)).length;

      await expect(
        versions.clone(origen.id, "x".repeat(VERSION_LIMITS.labelMax + 1)),
      ).rejects.toThrow(VERSION_ERRORS.labelLong);
      expect(await versions.list(project.id)).toHaveLength(antes);
    });

    it("clonar lo que no es tuyo no clona nada", async () => {
      const mia = await versions.active(project.id);
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      await expect(versions.clone(mia.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("renombrar", () => {
    it("cambia la etiqueta", async () => {
      const version = await versions.active(project.id);

      expect((await versions.rename(version.id, "Con pagos")).label).toBe("Con pagos");
    });

    /** Vaciar el campo devuelve la Versión a llamarse por su número. */
    it("vaciar la etiqueta la deja sin etiqueta", async () => {
      const version = await versions.active(project.id);
      await versions.rename(version.id, "Con pagos");

      expect((await versions.rename(version.id, "  ")).label).toBeNull();
    });

    it("rechaza una etiqueta que no cabe", async () => {
      const version = await versions.active(project.id);

      await expect(
        versions.rename(version.id, "x".repeat(VERSION_LIMITS.labelMax + 1)),
      ).rejects.toThrow(ConflictError);
    });

    it("renombrar lo que no es tuyo no renombra nada", async () => {
      const mia = await versions.active(project.id);
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      await expect(versions.rename(mia.id, "Mía ahora")).rejects.toThrow(NotFoundError);
    });
  });

  describe("borrar", () => {
    it("se lleva la Versión y su árbol", async () => {
      const primera = await versions.active(project.id);
      const segunda = await versions.clone(primera.id, "Rumbo B");
      await backend.nodes.create({ versionId: segunda.id, content: "Idea" });

      await versions.remove(segunda.id);

      expect((await versions.list(project.id)).map((v) => v.id)).toEqual([primera.id]);
      expect(await backend.nodes.listByVersion(segunda.id)).toEqual([]);
    });

    /**
     * El criterio del ticket: imposible desde la UI Y rechazado por el
     * servicio. Esto es la segunda mitad — la regla no depende de que la
     * pantalla se acuerde de esconder el botón.
     */
    it("la última que queda no se puede borrar", async () => {
      const unica = await versions.active(project.id);

      await expect(versions.remove(unica.id)).rejects.toThrow(ConflictError);
      expect(await versions.list(project.id)).toHaveLength(1);
    });

    it("y deja de ser la última en cuanto hay otra", async () => {
      const primera = await versions.active(project.id);
      await versions.clone(primera.id);

      await expect(versions.remove(primera.id)).resolves.toBeUndefined();
    });

    /**
     * `on delete set null` en la migración: el clon ya es independiente, así
     * que perder de vista su origen no puede llevárselo por delante.
     */
    it("borrar el origen no se lleva al clon", async () => {
      const origen = await versions.active(project.id);
      const clon = await versions.clone(origen.id, "Rumbo B");

      await versions.remove(origen.id);

      const [superviviente] = await versions.list(project.id);
      expect(superviviente!.id).toBe(clon.id);
      expect(superviviente!.sourceVersionId).toBeNull();
    });

    it("borrar lo que no es tuyo no borra nada", async () => {
      const primera = await versions.active(project.id);
      await versions.clone(primera.id);
      await backend.auth.signOut();
      await signUp("otra@correo.com");

      await expect(versions.remove(primera.id)).rejects.toThrow(NotFoundError);
    });
  });
});
