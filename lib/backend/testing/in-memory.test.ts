/**
 * La contract suite contra el adaptador en memoria.
 *
 * Corre siempre, sin red ni credenciales, y es la que hace que la suite sea
 * barata de ejecutar. Contra el adaptador activo corre la misma suite en
 * `live.test.ts`, bajo demanda.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { RESET_TOKEN_RULE, UnauthenticatedError } from "@/lib/backend/ports";
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

/**
 * El flujo de recuperación (#22), contra el doble.
 *
 * Aquí es donde los criterios del ticket se pueden AFIRMAR en vez de mirarlos en
 * una pantalla: que pedir el enlace contesta lo mismo exista o no la cuenta, que
 * la contraseña vieja deja de valer, y que un enlace ya usado no sirve dos
 * veces. Las tres son promesas del PUERTO, así que el doble tiene que
 * cumplirlas o la suite dejaría pasar un adaptador que no las cumple.
 */
describe("adaptador en memoria: recuperar la contraseña", () => {
  let backend: InMemoryBackend;

  const VIEJA = "contraseña-vieja";
  const NUEVA = "contraseña-nueva";
  const EMAIL = "olvidadizo@rice-zero.invalid";
  const VUELTA = "https://rice-zero.invalid/reset-password";

  /** Pide el enlace y devuelve el token que el usuario leería en el correo. */
  async function pedirEnlace(email: string): Promise<string | null> {
    await backend.auth.sendPasswordReset(email, VUELTA);
    return backend.resetTokenFor(email);
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await backend.auth.signUpWithEmail({ email: EMAIL, password: VIEJA });
    backend.verifyEmail(EMAIL);
  });

  it("contesta lo mismo exista o no la cuenta", async () => {
    // El criterio del ticket. Lo que se afirma es que la llamada NO lanza y no
    // devuelve nada distinto: desde fuera, las dos son indistinguibles. La
    // diferencia —que solo una generó token— solo se ve desde dentro del doble.
    await expect(
      backend.auth.sendPasswordReset(EMAIL, VUELTA),
    ).resolves.toBeUndefined();
    await expect(
      backend.auth.sendPasswordReset("nadie@rice-zero.invalid", VUELTA),
    ).resolves.toBeUndefined();

    expect(backend.resetTokenFor("nadie@rice-zero.invalid")).toBeNull();
  });

  it("la contraseña nueva entra y la vieja deja de valer", async () => {
    const token = await pedirEnlace(EMAIL);
    await backend.auth.resetPassword(token as string, NUEVA);

    await expect(
      backend.auth.signInWithEmail({ email: EMAIL, password: VIEJA }),
    ).rejects.toThrow(UnauthenticatedError);

    const session = await backend.auth.signInWithEmail({
      email: EMAIL,
      password: NUEVA,
    });
    expect(session.user.email).toBe(EMAIL);
  });

  it("no deja sesión abierta", async () => {
    // Tener el token prueba que se controla el buzón, no que la cuenta pueda
    // actuar. La interfaz cuenta con esto para mandar a «Entrar» al terminar.
    const token = await pedirEnlace(EMAIL);
    await backend.auth.resetPassword(token as string, NUEVA);

    expect(await backend.auth.currentSession()).toBeNull();
  });

  it("un enlace no se puede usar dos veces", async () => {
    const token = await pedirEnlace(EMAIL);
    await backend.auth.resetPassword(token as string, NUEVA);

    await expect(
      backend.auth.resetPassword(token as string, "otra-contraseña"),
    ).rejects.toMatchObject({ name: "ConflictError", rule: RESET_TOKEN_RULE });
  });

  it("pedir el enlace dos veces deja valer el del último correo", async () => {
    // El doble prometía «el último» y devolvía el PRIMERO: recorría el mapa y
    // salía en el primer match. Ningún test lo cazaba porque todos pedían un
    // solo enlace — y este doble es justo lo que sustituye al criterio «fijar la
    // contraseña nueva deja entrar con ella».
    const primero = await pedirEnlace(EMAIL);
    const segundo = await pedirEnlace(EMAIL);
    expect(segundo).not.toBe(primero);

    await backend.auth.resetPassword(segundo as string, NUEVA);
    const session = await backend.auth.signInWithEmail({
      email: EMAIL,
      password: NUEVA,
    });
    expect(session.user.email).toBe(EMAIL);
  });

  it("un token inventado se rechaza igual que uno gastado", async () => {
    // Misma categoría y misma regla: distinguirlos le diría a quien prueba
    // tokens al azar cuáles existieron alguna vez.
    await expect(
      backend.auth.resetPassword("token-que-nadie-emitió", NUEVA),
    ).rejects.toMatchObject({ name: "ConflictError", rule: RESET_TOKEN_RULE });
  });

  it("no confirma el email de paso", async () => {
    // La decisión del ticket, afirmada: una cuenta sin confirmar que resetea su
    // contraseña sigue sin poder entrar. Es lo que obliga a que la pantalla de
    // éxito lo avise en vez de prometer que ya se puede entrar.
    const sinConfirmar = "pendiente@rice-zero.invalid";
    await backend.auth.signUpWithEmail({
      email: sinConfirmar,
      password: VIEJA,
    });

    const token = await pedirEnlace(sinConfirmar);
    await backend.auth.resetPassword(token as string, NUEVA);

    await expect(
      backend.auth.signInWithEmail({ email: sinConfirmar, password: NUEVA }),
    ).rejects.toThrow(UnauthenticatedError);
  });
});
