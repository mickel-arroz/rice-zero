/**
 * La contract suite contra el adaptador en memoria.
 *
 * Corre siempre, sin red ni credenciales, y es la que hace que la suite sea
 * barata de ejecutar. Contra el adaptador activo corre la misma suite en
 * `live.test.ts`, bajo demanda.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { UnauthenticatedError } from "@/lib/backend/ports";
import { createInMemoryBackend, type InMemoryBackend } from "@/lib/backend/testing/in-memory";
import { describeBackendContract } from "@/lib/backend/testing/contract";

/** Una cuenta ya verificada y con sesión abierta, que es el punto de partida. */
async function signedIn(): Promise<InMemoryBackend> {
  const backend = createInMemoryBackend();
  const email = "contrato@rice-zero.invalid";
  await backend.auth.signUpWithEmail({ email, password: "contraseña-larga" });
  backend.verifyEmail(email);
  await backend.auth.signInWithEmail({ email, password: "contraseña-larga" });
  return backend;
}

describeBackendContract({
  name: "en memoria",
  setUp: signedIn,
  // Cada bloque arranca con un backend nuevo, así que no hay nada que limpiar.
  tearDown: async () => {},
});

/**
 * Lo que el adaptador en memoria promete por encima del puerto: aislamiento
 * entre usuarios y el flujo de verificación. Va aparte de la contract suite
 * porque contra un backend real hacen falta dos cuentas de verdad, y eso ya se
 * verifica contra el motor (`db/tests/verify_rls_and_clone.sql`).
 */
describe("adaptador en memoria: aislamiento entre usuarios", () => {
  let backend: InMemoryBackend;

  const A = { email: "a@rice-zero.invalid", password: "contraseña-de-a" };
  const B = { email: "b@rice-zero.invalid", password: "contraseña-de-b" };

  async function register(credentials: typeof A) {
    await backend.auth.signUpWithEmail(credentials);
    backend.verifyEmail(credentials.email);
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await register(A);
    await register(B);
  });

  it("no deja entrar sin confirmar el email", async () => {
    const email = "sin-confirmar@rice-zero.invalid";
    const result = await backend.auth.signUpWithEmail({ email, password: "x-larga" });

    expect(result.needsEmailVerification).toBe(true);
    await expect(
      backend.auth.signInWithEmail({ email, password: "x-larga" }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  it("B no ve los Proyectos de A", async () => {
    await backend.auth.signInWithEmail(A);
    await backend.projects.create({ title: "De A" });

    await backend.auth.signInWithEmail(B);

    expect(await backend.projects.list()).toEqual([]);
  });

  it("B no puede leer un Proyecto de A ni sabiendo el id", async () => {
    await backend.auth.signInWithEmail(A);
    const project = await backend.projects.create({ title: "De A" });

    await backend.auth.signInWithEmail(B);

    // NotFoundError, no un error de permisos: distinguirlos le confirmaría a
    // un atacante que el recurso existe.
    await expect(backend.projects.get(project.id)).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("B no puede editar ni borrar un Proyecto de A", async () => {
    await backend.auth.signInWithEmail(A);
    const project = await backend.projects.create({ title: "De A" });

    await backend.auth.signInWithEmail(B);
    await expect(
      backend.projects.update(project.id, { title: "Secuestrado" }),
    ).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(backend.projects.delete(project.id)).rejects.toMatchObject({
      name: "NotFoundError",
    });

    await backend.auth.signInWithEmail(A);
    expect((await backend.projects.get(project.id)).title).toBe("De A");
  });

  it("B no puede clonar una Versión de A", async () => {
    await backend.auth.signInWithEmail(A);
    const project = await backend.projects.create({ title: "De A" });
    const version = await backend.versions.create({ projectId: project.id });

    await backend.auth.signInWithEmail(B);

    await expect(backend.versions.clone(version.id)).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("sin sesión no hay datos", async () => {
    await backend.auth.signInWithEmail(A);
    await backend.projects.create({ title: "De A" });
    await backend.auth.signOut();

    await expect(backend.projects.list()).rejects.toThrow(UnauthenticatedError);
  });
});
