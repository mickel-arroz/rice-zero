/**
 * La capa de servicios de Versiones, contra el adaptador en memoria.
 *
 * Mismo criterio que `nodes.test.ts`: el doble implementa el mismo `RowStore`
 * que Neon y Supabase, RLS incluida, así que «no es tuyo» se comprueba de
 * verdad y no contra un mock que dice que sí.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  NotFoundError,
  type BackendProvider,
  type Project,
} from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import { createVersionService, type VersionService } from "@/lib/services/versions";

describe("capa de servicios: Versiones", () => {
  let backend: InMemoryBackend;
  let versions: VersionService;
  let project: Project;

  const PASSWORD = "contraseña-larga";

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
    await expect(
      versions.active("00000000-0000-4000-8000-999999999999"),
    ).rejects.toThrow(NotFoundError);
  });
});
