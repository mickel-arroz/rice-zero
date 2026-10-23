/**
 * La capa de servicios de la Propuesta de Nodos, contra el adaptador en memoria.
 *
 * Mismo montaje que `analyses.test.ts`: se inyecta la mitad de servidor —el
 * Server Action— y el resto corre de verdad. Lo que se afirma son las dos
 * reglas que hacen a la Propuesta distinta de un Análisis: viaja el árbol SIN
 * el Subárbol completado, y no se guarda nada.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  describeAnalysisFailure,
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  QuotaExceededError,
  RemoteAnalysisError,
} from "@/lib/ai/errors";
import type { Proposal } from "@/lib/ai/proposal";
import type { BackendProvider, ProjectVersion } from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import {
  createProposalService,
  type GenerateProposal,
  type ProposalService,
} from "@/lib/services/proposals";

const PROPOSAL: Proposal = {
  roots: [{ text: "Menú semanal", children: [{ text: "Un día por receta", children: [] }] }],
};

describe("capa de servicios: Propuesta de Nodos", () => {
  let backend: InMemoryBackend;
  let version: ProjectVersion;

  const EMAIL = "tu@correo.com";
  const PASSWORD = "contraseña-larga";

  function respondingWith(proposal: unknown = PROPOSAL) {
    return vi.fn<GenerateProposal>(async () => ({
      ok: true,
      model: "sin-modelo",
      proposal: proposal as Proposal,
    }));
  }

  function serviceWith(generate: GenerateProposal): ProposalService {
    return createProposalService(backend as BackendProvider, generate);
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await backend.auth.signUpWithEmail({ email: EMAIL, password: PASSWORD });
    backend.verifyEmail(EMAIL);
    await backend.auth.signInWithEmail({ email: EMAIL, password: PASSWORD });

    const project = await backend.projects.create({ title: "Recetas" });
    [version] = await backend.versions.listByProject(project.id);
  });

  it("devuelve la Propuesta y el modelo que la escribió", async () => {
    await backend.nodes.create({ versionId: version.id, content: "Recetas" });

    const outcome = await serviceWith(respondingWith()).propose({
      versionId: version.id,
      request: "Planificar la semana",
    });

    expect(outcome).toEqual({ proposal: PROPOSAL, model: "sin-modelo" });
  });

  it("manda el pedido y el árbol serializado, sin el Subárbol completado", async () => {
    await backend.nodes.create({ versionId: version.id, content: "Pendiente" });
    const done = await backend.nodes.create({ versionId: version.id, content: "Hecho" });
    await backend.nodes.create({
      versionId: version.id,
      parentId: done.id,
      content: "Colgando de lo hecho",
    });
    await backend.nodes.update(done.id, { completed: true });
    const generate = respondingWith();

    await serviceWith(generate).propose({ versionId: version.id, request: "  Más ideas " });

    const [sent] = generate.mock.calls[0];
    expect(sent.request).toBe("Más ideas");
    expect(sent.serializedTree).toBe("- Pendiente");
  });

  it("propone también sobre una Versión vacía", async () => {
    const generate = respondingWith();

    await serviceWith(generate).propose({ versionId: version.id, request: "Empezar" });

    expect(generate.mock.calls[0][0].serializedTree).toBe("");
  });

  it("no guarda nada: ni Nodos ni un Análisis en el Historial", async () => {
    await backend.nodes.create({ versionId: version.id, content: "Recetas" });

    await serviceWith(respondingWith()).propose({
      versionId: version.id,
      request: "Planificar la semana",
    });

    expect(await backend.nodes.listByVersion(version.id)).toHaveLength(1);
    expect(await backend.analyses.listByVersion(version.id)).toHaveLength(0);
  });

  it("un pedido en blanco no llega a llamar a la IA", async () => {
    const generate = respondingWith();

    await expect(
      serviceWith(generate).propose({ versionId: version.id, request: "   " }),
    ).rejects.toThrow(InvalidAnalysisInputError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("un fallo del servidor vuelve como excepción, con su categoría", async () => {
    const generate = vi.fn<GenerateProposal>(async () => ({
      ok: false,
      failure: describeAnalysisFailure(new QuotaExceededError()),
    }));

    const error = await serviceWith(generate)
      .propose({ versionId: version.id, request: "Algo" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RemoteAnalysisError);
    expect((error as RemoteAnalysisError).kind).toBe("cuota");
  });

  it("lo que vuelve se valida otra vez: una Propuesta fuera de los topes no pasa", async () => {
    const six = { roots: Array.from({ length: 6 }, () => ({ text: "R", children: [] })) };

    await expect(
      serviceWith(respondingWith(six)).propose({ versionId: version.id, request: "Algo" }),
    ).rejects.toThrow(MalformedAnalysisError);
  });
});
