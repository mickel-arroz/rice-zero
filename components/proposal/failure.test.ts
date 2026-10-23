import { describe, expect, it } from "vitest";

import { proposalFailure } from "@/components/proposal/failure";
import {
  AnalysisConfigError,
  AnalysisNetworkError,
  describeAnalysisFailure,
  MalformedAnalysisError,
  QuotaExceededError,
  RemoteAnalysisError,
  SessionRequiredError,
} from "@/lib/ai";
import { ConflictError } from "@/lib/backend/ports";
import { ANALYSIS_COPY, PROPOSAL_COPY } from "@/lib/constants";

/**
 * Los fallos llegan como `RemoteAnalysisError`, que es como los relanza el
 * Servicio de Propuestas después de cruzar el Server Action. Construirlos con
 * las clases de verdad prueba el camino que recorren, no una forma a mano.
 */
const remote = (error: Error) =>
  new RemoteAnalysisError(describeAnalysisFailure(error));

describe("Propuesta de Nodos: qué dice el diálogo cuando falla", () => {
  it("la cuota se llama como en el Análisis, con su pista del free tier", () => {
    const error = new QuotaExceededError(38);

    expect(proposalFailure(remote(error))).toEqual({
      title: ANALYSIS_COPY.failures.cuota,
      message: error.message,
      hint: ANALYSIS_COPY.quotaHint,
      login: false,
    });
  });

  it("la API key que falta NO se confunde con la cuota", () => {
    const error = new AnalysisConfigError("Falta GEMINI_API_KEY.", "GEMINI_API_KEY");

    expect(proposalFailure(remote(error))).toEqual({
      title: ANALYSIS_COPY.failures.configuracion,
      message: error.message,
      hint: null,
      login: false,
    });
  });

  it("sin sesión, lo que se ofrece es entrar", () => {
    expect(proposalFailure(remote(new SessionRequiredError())).login).toBe(true);
  });

  // A pelo y no con `remote`: este llega así, de la segunda validación que
  // hace el propio Servicio de Propuestas, sin cruzar el Server Action.
  it("lo que no es una Propuesta se dice con su nombre, no con el del Análisis", () => {
    const view = proposalFailure(new MalformedAnalysisError(["roots: demasiadas"]));

    expect(view.title).toBe(PROPOSAL_COPY.failures.malformada);
    expect(view.title).not.toMatch(/Análisis/);
    expect(view.message).not.toMatch(/Análisis/);
  });

  it("la red de la IA conserva su título", () => {
    expect(proposalFailure(remote(new AnalysisNetworkError())).title).toBe(
      ANALYSIS_COPY.failures.red,
    );
  });

  it("un fallo del backend al leer el árbol no se disfraza de fallo de la IA", () => {
    const error = new ConflictError("arbol", "El árbol cambió mientras lo leías.");

    expect(proposalFailure(error)).toEqual({
      title: PROPOSAL_COPY.errorTitle,
      message: error.message,
      hint: null,
      login: false,
    });
  });
});
