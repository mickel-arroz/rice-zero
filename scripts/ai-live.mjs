/**
 * Lanza la generación EN VIVO contra Gemini.
 *
 *     npm run ai:live
 *
 * Son TRES llamadas al modelo. En el free tier de Gemini eso no es nada, pero
 * tampoco es gratis: este comando se lanza a mano y a conciencia.
 *
 * Lo mecánico —exigir las variables, resolver vitest, distinguir «falló el
 * test» de «no pude ni arrancar»— es `live-runner.mjs`, compartido con
 * `contract-live.mjs`.
 */

import { loadEnvLocal } from "./env-local.mjs";
import { requireLiveEnv, runLiveVitest } from "./live-runner.mjs";

loadEnvLocal();

requireLiveEnv(["AI_LIVE", "GEMINI_API_KEY"], [
  "  AI_LIVE=1 va aparte de la API key a propósito: la key está en .env.local",
  "  porque el panel la necesita en desarrollo, y eso no debe bastar para que",
  "  una corrida despistada se coma la cuota del día.",
  "",
  "  La key se saca en https://aistudio.google.com/apikey (free tier).",
  "",
  "  Con AI_LIVE_CONTRACT=1 corre además la contract suite entera contra",
  "  Gemini: son doce llamadas más y el free tier puede cortarlas por límite",
  "  de peticiones por minuto.",
]);

// `--config`: la configuración de siempre excluye los `*.live.test.ts` para que
// `npm test` no pida red, y la de la contract suite del backend finge un
// navegador —cosa que aquí sobra y estorba—. Ver `vitest.ai-live.config.ts`.
runLiveVitest(
  "vitest.ai-live.config.ts",
  "lib/ai/adapters/gemini/gemini.live.test.ts",
);
