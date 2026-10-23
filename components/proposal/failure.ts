/**
 * Qué dice el diálogo de la Propuesta de Nodos cuando falla.
 *
 * Los mismos mensajes que el Análisis (#68), y por eso se parte de la misma
 * taxonomía: el título sale del `kind` —así es como se distingue la cuota de la
 * API key que falta— y el cuerpo es el que escribió la clase que falló, que ya
 * viene en español y ya dice lo concreto.
 *
 * Mismo criterio que `components/analysis/panel.ts`: la decisión se saca a una
 * función pura para probarla sin montar el diálogo.
 *
 * Módulo puro: no importa React ni toca red.
 */

import {
  AnalysisError,
  describeAnalysisFailure,
  type AnalysisErrorKind,
} from "@/lib/ai";
import { ANALYSIS_COPY, PROPOSAL_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";

export type ProposalFailureView = {
  title: string;
  message: string;
  /** La pista del free tier. Solo la cuota la lleva. */
  hint: string | null;
  /** Sin sesión, lo que hace falta es entrar, no reintentar. */
  login: boolean;
};

/**
 * Un título por categoría: los del Análisis, con los dos que lo nombran
 * cambiados. Tipado como `Record` para que una categoría nueva en la taxonomía
 * sin título aquí no compile.
 */
const TITLES: Record<AnalysisErrorKind, string> = {
  ...ANALYSIS_COPY.failures,
  ...PROPOSAL_COPY.failures,
};

/**
 * @param error lo que lanzó `proposalService.propose`. Puede ser un fallo de
 *   la IA (`AnalysisError`) o del backend al leer el árbol antes de pedir.
 */
export function proposalFailure(error: unknown): ProposalFailureView {
  // Lo que falló antes de llegar a la IA —leer el árbol— se dice tal cual.
  // Pasarlo por `describeAnalysisFailure` lo convertiría en «No se pudo
  // contactar con la IA», que es mentira.
  if (!(error instanceof AnalysisError)) {
    return {
      title: PROPOSAL_COPY.errorTitle,
      message: errorMessage(error),
      hint: null,
      login: false,
    };
  }

  const { kind, message } = describeAnalysisFailure(error);
  return {
    title: TITLES[kind],
    // El cuerpo de la clase habla de «un Análisis válido».
    message: kind === "malformada" ? PROPOSAL_COPY.malformedMessage : message,
    hint: kind === "cuota" ? ANALYSIS_COPY.quotaHint : null,
    login: kind === "sesion",
  };
}
