/**
 * La contract suite, corrida contra el proveedor falso.
 *
 * Sin red y sin API key: es este archivo el que hace que el criterio «cero red
 * en todo el ticket» sea comprobable con `npm test` a secas. El día que exista
 * el adaptador de Gemini, su corrida en vivo llamará a la MISMA
 * `describeAnalysisContract` desde un `.live.test.ts`.
 */

import { describeAnalysisContract } from "@/lib/ai/testing/contract";
import { fakeAnalysisProvider } from "@/lib/ai/testing/fake";

describeAnalysisContract({
  name: "falso",
  provider: fakeAnalysisProvider,
});
