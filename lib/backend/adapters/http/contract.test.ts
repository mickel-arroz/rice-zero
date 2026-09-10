/**
 * La contract suite, CRUZANDO EL CABLE.
 *
 * Es la misma suite que corre contra el adaptador en memoria, pero con los doce
 * Route Handlers de verdad en medio. Lo que añade sobre aquélla es todo lo que
 * el ADR 0006 introdujo y nada más podía probar sin levantar un servidor: la
 * serialización, el revivido de fechas, y que los cinco errores del puerto
 * llegan al otro lado como instancias de su clase y con sus campos.
 *
 * Si esto pasa entero, el adaptador HTTP está terminado, igual que cualquier
 * otro: es lo que `lib/backend/testing/contract.ts` declara en su cabecera.
 */

import { describe, expect, it } from "vitest";

import { NotFoundError } from "@/lib/backend/ports";
import { describeBackendContract } from "@/lib/backend/testing/contract";
import {
  createLoopbackBackend,
  type LoopbackBackend,
} from "@/lib/backend/testing/loopback";

/** Una cuenta ya verificada y con sesión abierta, que es el punto de partida. */
async function signedIn(): Promise<LoopbackBackend> {
  const backend = createLoopbackBackend();
  const email = "cable@rice-zero.invalid";
  await backend.auth.signUpWithEmail({ email, password: "contraseña-larga" });
  backend.inMemory.verifyEmail(email);
  await backend.auth.signInWithEmail({ email, password: "contraseña-larga" });
  return backend;
}

describeBackendContract({
  name: "HTTP sobre las rutas de la app",
  setUp: signedIn,
  // Cada bloque arranca con un backend nuevo, así que no hay nada que limpiar.
  tearDown: async () => {},
});

/**
 * Lo que solo se puede comprobar aquí: que el cable no deforma nada. La
 * contract suite ya lo ejercita de refilón en cada aserción, pero un fallo ahí
 * se leería como «el puerto está roto» en vez de «la serialización lo está».
 */
describe("el cable no deforma lo que lleva", () => {
  it("las fechas vuelven siendo fechas y no cadenas", async () => {
    const backend = await signedIn();
    const project = await backend.projects.create({ title: "Tienda" });

    expect(project.createdAt).toBeInstanceOf(Date);
    expect(project.updatedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(project.createdAt.getTime())).toBe(false);
  });

  it("las fechas anidadas de una lista también", async () => {
    const backend = await signedIn();
    await backend.projects.create({ title: "Tienda" });

    const [overview] = await backend.projects.listOverviews();
    expect(overview.lastActivityAt).toBeInstanceOf(Date);
    expect(overview.createdAt).toBeInstanceOf(Date);
  });

  it("el contenido de un Análisis NO se toca al cruzar", async () => {
    // La razón de encajonar las fechas en vez de revivir por patrón: dentro de
    // un Análisis puede haber texto con pinta de fecha, y es texto.
    const backend = await signedIn();
    const project = await backend.projects.create({ title: "Tienda" });
    const [version] = await backend.versions.listByProject(project.id);

    const content = {
      intent: { kind: "nuevo", rationale: "Migrar antes de 2026-09-10T00:00:00.000Z" },
    };
    const analysis = await backend.analyses.create({
      versionId: version.id,
      provider: "falso",
      model: "falso",
      // El puerto exige un `AnalysisContent` completo; aquí solo importa que lo
      // que entra por el cable salga igual, así que se fuerza el tipo.
      content: content as never,
    });

    const back = analysis.content as unknown as typeof content;
    expect(typeof back.intent.rationale).toBe("string");
    expect(back.intent.rationale).toBe(content.intent.rationale);
  });

  it("un NotFoundError llega con su recurso y su id", async () => {
    const backend = await signedIn();

    await expect(
      backend.projects.get("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(NotFoundError);

    let caught: unknown;
    try {
      await backend.projects.get("00000000-0000-0000-0000-000000000000");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(NotFoundError);
    const error = caught as NotFoundError;
    expect(error.resource).toBeTruthy();
    expect(error.id).toBe("00000000-0000-0000-0000-000000000000");
  });

  it("un id con caracteres raros no rompe la ruta", async () => {
    // `encodeURIComponent` en el adaptador: sin él, un id con `/` o `?` se
    // leería como otra ruta y el fallo sería un 404 que no significa lo que
    // parece.
    const backend = await signedIn();
    await expect(backend.projects.get("a/b?c=d")).rejects.toThrow(NotFoundError);
  });
});
