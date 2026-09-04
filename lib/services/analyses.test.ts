/**
 * La capa de servicios de Análisis, contra el adaptador en memoria.
 *
 * Mismo criterio que `nodes.test.ts`: el doble implementa el mismo `RowStore`
 * que Neon y Supabase, así que aquí se ejercita el núcleo compartido de verdad
 * —RLS incluida— y no un mock que dice sí a todo.
 *
 * Lo que se inyecta es la GENERACIÓN, porque esa mitad corre en el servidor: el
 * servicio vive en el navegador y llama al Server Action. Con un doble en ese
 * punto, este archivo prueba el servicio entero —la serialización del árbol,
 * las Directrices, la persistencia y la traducción de los fallos— sin red y
 * sin gastar una petición de cuota.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisTimeoutError,
  MalformedAnalysisError,
  QuotaExceededError,
  RemoteAnalysisError,
  describeAnalysisFailure,
} from "@/lib/ai/errors";
import { sampleAnalysis } from "@/lib/ai/testing/samples";
import type { BackendProvider, ProjectVersion } from "@/lib/backend/ports";
import {
  createInMemoryBackend,
  type InMemoryBackend,
} from "@/lib/backend/testing/in-memory";
import {
  ANALYSIS_ERRORS,
  createAnalysisService,
  type AnalysisService,
  type GenerateAnalysis,
} from "@/lib/services/analyses";

describe("capa de servicios: Análisis", () => {
  let backend: InMemoryBackend;
  let version: ProjectVersion;

  const EMAIL = "tu@correo.com";
  const PASSWORD = "contraseña-larga";

  /** Un Server Action que devuelve este Análisis, y cuenta cómo lo llamaron. */
  function respondingWith(content = sampleAnalysis()) {
    return vi.fn<GenerateAnalysis>(async () => ({
      ok: true,
      provider: "falso",
      model: "sin-modelo",
      content,
    }));
  }

  /** Un Server Action que devuelve este fallo, ya serializado. */
  function failingWith(error: unknown) {
    return vi.fn<GenerateAnalysis>(async () => ({
      ok: false,
      failure: describeAnalysisFailure(error),
    }));
  }

  function serviceWith(generate: GenerateAnalysis): AnalysisService {
    return createAnalysisService(backend as BackendProvider, generate);
  }

  beforeEach(async () => {
    backend = createInMemoryBackend();
    await backend.auth.signUpWithEmail({ email: EMAIL, password: PASSWORD });
    backend.verifyEmail(EMAIL);
    await backend.auth.signInWithEmail({ email: EMAIL, password: PASSWORD });

    const project = await backend.projects.create({ title: "Tienda online" });
    [version] = await backend.versions.listByProject(project.id);

    await backend.nodes.create({ versionId: version.id, content: "Catálogo" });
    await backend.nodes.create({ versionId: version.id, content: "Carrito" });
  });

  describe("generar", () => {
    it("persiste el Análisis que devolvió el servidor, con quién lo hizo", async () => {
      const content = sampleAnalysis();
      const analyses = serviceWith(respondingWith(content));

      const analysis = await analyses.generate({ versionId: version.id });

      expect(analysis.content).toEqual(content);
      expect(analysis.provider).toBe("falso");
      expect(analysis.model).toBe("sin-modelo");
      expect(analysis.versionId).toBe(version.id);
    });

    it("y queda guardado, no solo devuelto", async () => {
      const analyses = serviceWith(respondingWith());

      const created = await analyses.generate({ versionId: version.id });

      expect((await analyses.list(version.id)).map((a) => a.id)).toEqual([created.id]);
    });

    /**
     * El servidor recibe el árbol YA serializado. Lo fija el puerto de la IA:
     * la serialización es una decisión del dominio del árbol, y dos sitios que
     * la repitieran a su manera darían Análisis distintos del mismo árbol.
     */
    it("serializa el árbol aquí y manda el texto, no los Nodos", async () => {
      const generate = respondingWith();

      await serviceWith(generate).generate({ versionId: version.id });

      const [request] = generate.mock.calls[0];
      expect(request.serializedTree).toContain("- Catálogo");
      expect(request.serializedTree).toContain("- Carrito");
    });

    it("las Directrices del Usuario viajan, y se guardan con el Análisis", async () => {
      const generate = respondingWith();
      const guidelines = "Esto es un fix, no un proyecto nuevo.";

      const analysis = await serviceWith(generate).generate({
        versionId: version.id,
        guidelines,
      });

      expect(generate.mock.calls[0][0].guidelines).toBe(guidelines);
      expect(analysis.userGuidelines).toBe(guidelines);
    });

    /** «En blanco» y «no escribió nada» son lo mismo para una persona. */
    it("unas Directrices en blanco es no haber escrito ninguna", async () => {
      const generate = respondingWith();

      const analysis = await serviceWith(generate).generate({
        versionId: version.id,
        guidelines: "  \n ",
      });

      expect(generate.mock.calls[0][0].guidelines).toBeNull();
      expect(analysis.userGuidelines).toBeNull();
    });

    describe("una Versión sin nada escrito no se manda", () => {
      /**
       * Es la única regla de dominio que este servicio añade, y se para ANTES
       * de llamar: un árbol vacío se llevaría una petición de cuota para que el
       * modelo se invente un proyecto entero de la nada.
       */
      it("se rechaza sin gastar una petición", async () => {
        const empty = await backend.versions.create({ projectId: version.projectId });
        const generate = respondingWith();

        await expect(
          serviceWith(generate).generate({ versionId: empty.id }),
        ).rejects.toThrow(ANALYSIS_ERRORS.emptyVersion);
        expect(generate).not.toHaveBeenCalled();
      });

      /**
       * Un Nodo creado y todavía sin texto es lo normal recién pulsado «Primer
       * Nodo». Serializado sale como `- (sin texto)`, que no es un árbol vacío
       * para `serializeTree` pero sí lo es para lo que aquí importa.
       */
      it("y un árbol de Nodos todos en blanco cuenta como vacío", async () => {
        const blank = await backend.versions.create({ projectId: version.projectId });
        await backend.nodes.create({ versionId: blank.id, content: "   " });
        const generate = respondingWith();

        await expect(
          serviceWith(generate).generate({ versionId: blank.id }),
        ).rejects.toThrow(ANALYSIS_ERRORS.emptyVersion);
        expect(generate).not.toHaveBeenCalled();
      });

      it("pero un solo Nodo con algo escrito sí se manda", async () => {
        const one = await backend.versions.create({ projectId: version.projectId });
        await backend.nodes.create({ versionId: one.id, content: "Una idea suelta" });
        const generate = respondingWith();

        await serviceWith(generate).generate({ versionId: one.id });

        expect(generate).toHaveBeenCalledOnce();
      });
    });
  });

  describe("los fallos del servidor llegan como excepciones", () => {
    /**
     * El Server Action DEVUELVE sus fallos en vez de lanzarlos —Next redacta
     * los `throw` del servidor en producción—, así que quien vuelve a
     * convertirlos en excepción es el servicio. Es lo que hace que un
     * componente los trate igual que los del backend, con un `catch`.
     */
    it("un fallo devuelto se lanza, conservando la categoría", async () => {
      const analyses = serviceWith(failingWith(new QuotaExceededError(26)));

      const error = await analyses.generate({ versionId: version.id }).catch((e) => e);

      expect(error).toBeInstanceOf(RemoteAnalysisError);
      expect((error as RemoteAnalysisError).kind).toBe("cuota");
      expect((error as RemoteAnalysisError).retryable).toBe(false);
      expect((error as RemoteAnalysisError).retryAfterSeconds).toBe(26);
    });

    /** Lo que el ADR 0003 promete: si no valida, no se guarda. */
    it("y nada se persiste cuando la generación falla", async () => {
      const analyses = serviceWith(failingWith(new AnalysisTimeoutError()));

      await expect(analyses.generate({ versionId: version.id })).rejects.toThrow();

      expect(await analyses.list(version.id)).toEqual([]);
    });
  });

  /**
   * La invariante del ADR 0003, afirmada en el sitio donde se persiste.
   *
   * Entre el `.parse` del adaptador y la escritura hay una frontera de
   * serialización, y un tipo al otro lado de una serialización no es una
   * garantía. Estos casos entran por ahí: un servidor que devolviera `ok: true`
   * con algo que no valida.
   */
  describe("nada que no valide llega a guardarse", () => {
    /** Bien formado y contra el contrato: el caso que el schema existe para cazar. */
    it("un Ticket sin Checks se rechaza antes de escribir", async () => {
      const broken = sampleAnalysis();
      broken.tickets[0].checks = [];
      const analyses = serviceWith(respondingWith(broken));

      const error = await analyses.generate({ versionId: version.id }).catch((e) => e);

      expect(error).toBeInstanceOf(MalformedAnalysisError);
      expect((error as MalformedAnalysisError).issues.join(" ")).toContain("checks");
      expect(await analyses.list(version.id)).toEqual([]);
    });

    it("y un ciclo de bloqueos, también", async () => {
      const cyclic = sampleAnalysis();
      cyclic.tickets[0].blockedBy = ["t3"];
      const analyses = serviceWith(respondingWith(cyclic));

      await expect(analyses.generate({ versionId: version.id })).rejects.toThrow(
        MalformedAnalysisError,
      );
      expect(await analyses.list(version.id)).toEqual([]);
    });
  });

  describe("leer", () => {
    it("lista los Análisis de una Versión, del más nuevo al más viejo", async () => {
      const analyses = serviceWith(respondingWith());
      const first = await analyses.generate({ versionId: version.id });
      const second = await analyses.generate({ versionId: version.id });

      expect((await analyses.list(version.id)).map((a) => a.id)).toEqual([
        second.id,
        first.id,
      ]);
    });
  });
});
