/**
 * La capa de servicios de Proyectos, contra el adaptador en memoria.
 *
 * Corre sobre un Proveedor de Backend de verdad —el mismo núcleo compartido que
 * usan Neon y Supabase— y no sobre un doble que dice sí a todo, así que lo que
 * se comprueba aquí es el comportamiento y no el cableado.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { ConflictError, type BackendProvider } from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import { createProjectService, type ProjectService } from "@/lib/services/projects";

describe("capa de servicios: Proyectos", () => {
  let backend: InMemoryBackend;
  let projects: ProjectService;

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await backend.auth.signUpWithEmail({
      email: "tu@correo.com",
      password: "contraseña-larga",
    });
    backend.verifyEmail("tu@correo.com");
    await backend.auth.signInWithEmail({
      email: "tu@correo.com",
      password: "contraseña-larga",
    });
    projects = createProjectService(backend as BackendProvider);
  });

  describe("el icono", () => {
    it("acepta una clave del catálogo", async () => {
      const project = await projects.create({ title: "Tienda", icon: "bag" });

      expect(project.icon).toBe("bag");
    });

    it("rechaza una clave que no está en el catálogo", async () => {
      // El motor no lo impide: su `check` es de longitud, porque el catálogo
      // vive en TypeScript para que añadir un icono no sea una migración. Este
      // es el sitio donde esa decisión se paga, así que es el sitio donde se
      // comprueba.
      await expect(
        projects.create({ title: "Tienda", icon: "hologram" }),
      ).rejects.toThrow(ConflictError);
    });

    it("no deja pasar una clave inválida tampoco al editar", async () => {
      const project = await projects.create({ title: "Tienda" });

      await expect(
        projects.update(project.id, { icon: "hologram" }),
      ).rejects.toThrow(ConflictError);
    });

    it("un icono inválido no llega a escribir nada", async () => {
      const project = await projects.create({ title: "Tienda", icon: "bag" });

      await projects.update(project.id, { icon: "hologram" }).catch(() => {});

      expect((await backend.projects.get(project.id)).icon).toBe("bag");
    });

    it("sin icono, el nodo cero", async () => {
      expect((await projects.create({ title: "Sin elegir" })).icon).toBe("node");
    });
  });

  describe("el alta", () => {
    it("crea el Proyecto con su Versión inicial", async () => {
      const project = await projects.create({ title: "Tienda online" });

      const versions = await backend.versions.listByProject(project.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].versionNumber).toBe(1);
    });

    it("recorta el título", async () => {
      expect((await projects.create({ title: "  Tienda  " })).title).toBe("Tienda");
    });

    it("una descripción en blanco es lo mismo que sin descripción", async () => {
      const project = await projects.create({ title: "Tienda", description: "   " });

      expect(project.description).toBeNull();
    });

    it("rechaza un título vacío sin llegar al motor", async () => {
      await expect(projects.create({ title: "   " })).rejects.toThrow(ConflictError);

      expect(await backend.projects.list()).toHaveLength(0);
    });

    it("rechaza un título más largo de lo que cabe", async () => {
      await expect(
        projects.create({ title: "x".repeat(201) }),
      ).rejects.toThrow(ConflictError);
    });

    it("rechaza una descripción más larga de lo que cabe", async () => {
      await expect(
        projects.create({ title: "Tienda", description: "x".repeat(2001) }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("la edición", () => {
    it("distingue «no lo toques» de «ponlo a nulo»", async () => {
      const project = await projects.create({
        title: "Antes",
        description: "Se queda.",
      });

      const renamed = await projects.update(project.id, { title: "Después" });
      expect(renamed.description).toBe("Se queda.");

      const cleared = await projects.update(project.id, { description: "  " });
      expect(cleared.description).toBeNull();
    });

    it("recorta el título al editar", async () => {
      const project = await projects.create({ title: "Antes" });

      expect((await projects.update(project.id, { title: " Después " })).title).toBe(
        "Después",
      );
    });
  });

  describe("la lista", () => {
    it("llega ordenada por última actividad, con sus cifras", async () => {
      const primero = await projects.create({ title: "Primero" });
      await projects.create({ title: "Segundo" });
      await projects.update(primero.id, { title: "Primero, retocado" });

      const list = await projects.list();

      expect(list.map((p) => p.title)).toEqual(["Primero, retocado", "Segundo"]);
      expect(list[0].versionCount).toBe(1);
      expect(list[0].nodeCount).toBe(0);
      expect(list[0].analysisCount).toBe(0);
    });

    it("está vacía cuando no hay Proyectos", async () => {
      expect(await projects.list()).toEqual([]);
    });
  });

  describe("el borrado", () => {
    it("se lleva el Proyecto y sus Versiones", async () => {
      const project = await projects.create({ title: "Muerta" });

      await projects.remove(project.id);

      expect(await projects.list()).toEqual([]);
      expect(await backend.versions.listByProject(project.id)).toEqual([]);
    });
  });
});
