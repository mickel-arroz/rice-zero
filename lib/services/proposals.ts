/**
 * La capa de servicios de la Propuesta de Nodos.
 *
 * Mismo reparto que `analyses.ts`: generar corre en el SERVIDOR —la API key no
 * sale de allí— y llega aquí inyectado; lo demás corre en el navegador. Pero
 * aquí falta la mitad que allí manda: **no se persiste nada**. La Propuesta se
 * enseña, y solo si el usuario la acepta se convierte en Nodos, por el camino
 * de siempre de los Nodos (`TreeProvider` → `nodeService`). Ni un Análisis en
 * el Historial ni una fila nueva sale de este archivo.
 *
 * Lo que sí se queda aquí es el orden: leer el árbol, serializarlo SIN el
 * Subárbol completado (`serializeTree` ya lo omite, ADR 0004), generar y
 * volver a validar lo que vuelve.
 */

import {
  InvalidAnalysisInputError,
  MalformedAnalysisError,
  RemoteAnalysisError,
  type AnalysisFailure,
} from "@/lib/ai/errors";
import type { ProposalPromptInput } from "@/lib/ai/prompt";
import { proposalSchema, type Proposal } from "@/lib/ai/proposal";
import { getBackend } from "@/lib/backend";
import type { BackendProvider } from "@/lib/backend/ports";
import { ANALYSIS_INPUT_LIMITS } from "@/lib/services/analyses";
import { serializeTree } from "@/lib/tree/serialize";

/**
 * Lo que cabe en un pedido.
 *
 * El árbol comparte tope con el Análisis porque es el MISMO árbol entrando por
 * la misma puerta. El pedido es más corto que unas Directrices: es una frase
 * sobre qué hacer crecer, no instrucciones para reescribir el árbol.
 */
export const PROPOSAL_INPUT_LIMITS = {
  treeMax: ANALYSIS_INPUT_LIMITS.treeMax,
  requestMax: 2_000,
} as const;

export const PROPOSAL_ERRORS = {
  noRequest: "Escribe qué quieres que crezca en el árbol.",
  requestTooLong: `El pedido no puede pasar de ${PROPOSAL_INPUT_LIMITS.requestMax.toLocaleString("es")} caracteres.`,
  treeNotText: "No llegó un árbol que leer.",
  treeTooBig: `El árbol es demasiado grande para leerlo de una vez (más de ${PROPOSAL_INPUT_LIMITS.treeMax.toLocaleString("es")} caracteres).`,
} as const;

/**
 * Exige que el pedido se pueda mandar. Lo usan las DOS mitades.
 *
 * El navegador para no gastar un viaje en algo que el servidor va a rechazar,
 * y el Server Action porque es un punto de entrada público y lo que le llega es
 * lo que venga en el POST. Una sola función para que el mismo rechazo no se
 * diga de dos maneras según por dónde entró.
 *
 * El árbol vacío SÍ vale, a diferencia del Análisis: hacer crecer una Versión
 * recién creada es justo el uso que no tiene otra puerta.
 *
 * @throws InvalidAnalysisInputError con el motivo, ya en español.
 */
export function requireProposableRequest(input: ProposalPromptInput): void {
  const { serializedTree, request } = input ?? {};

  if (typeof request !== "string" || request.trim().length === 0) {
    throw new InvalidAnalysisInputError(PROPOSAL_ERRORS.noRequest);
  }
  if (request.length > PROPOSAL_INPUT_LIMITS.requestMax) {
    throw new InvalidAnalysisInputError(PROPOSAL_ERRORS.requestTooLong);
  }
  if (typeof serializedTree !== "string") {
    throw new InvalidAnalysisInputError(PROPOSAL_ERRORS.treeNotText);
  }
  if (serializedTree.length > PROPOSAL_INPUT_LIMITS.treeMax) {
    throw new InvalidAnalysisInputError(PROPOSAL_ERRORS.treeTooBig);
  }
}

/** Lo que devuelve la mitad de servidor. Un resultado, por lo de `GenerateAnalysisResult`. */
export type GenerateProposalResult =
  | { ok: true; model: string; proposal: Proposal }
  | { ok: false; failure: AnalysisFailure };

export type GenerateProposal = (
  request: ProposalPromptInput,
) => Promise<GenerateProposalResult>;

export type ProposalService = {
  /**
   * Una Propuesta de Nodos para la Versión. No guarda nada.
   *
   * @throws InvalidAnalysisInputError si el pedido no se puede mandar.
   * @throws RemoteAnalysisError si la generación falló.
   * @throws MalformedAnalysisError si lo que volvió no es una Propuesta.
   */
  propose(input: { versionId: string; request: string }): Promise<{
    proposal: Proposal;
    model: string;
  }>;
};

export function createProposalService(
  backend: BackendProvider,
  generate: GenerateProposal,
): ProposalService {
  return {
    async propose({ versionId, request }) {
      const nodes = await backend.nodes.listByVersion(versionId);
      const input = {
        serializedTree: serializeTree(nodes),
        request: request.trim(),
      };
      requireProposableRequest(input);

      const result = await generate(input);
      if (!result.ok) throw new RemoteAnalysisError(result.failure);

      // Otra vez, por lo mismo que en `analyses.ts`: entre el `.parse` del
      // adaptador y aquí hay una serialización, y lo que se enseña y después se
      // escribe como Nodos tiene que cumplir los topes de verdad.
      const parsed = proposalSchema.safeParse(result.proposal);
      if (!parsed.success) {
        throw new MalformedAnalysisError(
          parsed.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`,
          ),
          { cause: parsed.error },
        );
      }

      return { proposal: parsed.data, model: result.model };
    },
  };
}

/** El servicio sobre el Proveedor de Backend activo. Ver `analysisService`. */
export function proposalService(generate: GenerateProposal): ProposalService {
  return createProposalService(getBackend(), generate);
}
