/**
 * El Proveedor de IA sobre Gemini.
 *
 * Es la ÚNICA capa que toca `@ai-sdk/google`, igual que `neon/store.ts` es la
 * única que toca el SDK de Neon, y ESLint lo sostiene: fuera de aquí el SDK no
 * se puede importar. Es lo que hace verdad la frase de `CONTEXT.md` —«el
 * proyecto es indiferente a cuál se usa»— en vez de dejarla como intención.
 *
 * `server-only` no es decoración: la API key se lee aquí, y este archivo tiene
 * que fallar al compilar si alguien lo importa desde un componente de cliente.
 * Es la mitad de mecánica del criterio «la API key no aparece en ningún bundle
 * de cliente»; la otra mitad es que `lib/ai/index.ts` NO reexporta ni esto ni
 * la fábrica.
 *
 * Lo que queda aquí es solo cómo se arma la llamada. Clasificar los fallos es
 * `errors.ts`, el prompt es `lib/ai/prompt.ts` y la forma de la respuesta es
 * `lib/ai/schema.ts`: este archivo no decide ninguna de las tres.
 */

import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";

import {
  GEMINI_API_KEY_ENV,
  normalizeGeminiError,
} from "@/lib/ai/adapters/gemini/errors";
import { AnalysisConfigError } from "@/lib/ai/errors";
import type { AnalysisProvider } from "@/lib/ai/port";
import { buildAnalysisPrompt, type AnalysisPromptInput } from "@/lib/ai/prompt";
import { analysisSchema, type Analysis } from "@/lib/ai/schema";
import { AI_CONFIG } from "@/lib/constants";

/** Cómo se llama este adaptador. Va a `ai_analyses` con cada Análisis. */
export const GEMINI_PROVIDER_NAME = "gemini";

/**
 * Lo que el modelo devolvió, sin validar todavía.
 *
 * Es el ÚNICO punto del adaptador que sale a la red, y por eso es el punto por
 * el que se inyecta en los tests. Devuelve `unknown` a propósito: quien lo
 * implemente —el SDK o un doble— no promete nada sobre la forma, y la promesa
 * la hace el `.parse` de abajo. Un `Promise<Analysis>` aquí habría movido la
 * frontera de validación al doble de test, que es donde no sirve de nada.
 */
export type GenerateAnalysisObject = (prompt: string) => Promise<unknown>;

/**
 * La API key, o un error que dice cuál falta.
 *
 * Toma el valor y no lo lee ella misma para poder probarse sin tocar el
 * entorno: un test que borrara `process.env.GEMINI_API_KEY` para comprobar
 * este caso saldría a la red de verdad en la máquina de quien SÍ la tiene
 * puesta en `.env.local` — y gastaría cuota justo en el test que existe para
 * no gastarla.
 *
 * Nunca incluye el valor recibido en el error, igual que `requireEnv` del
 * backend: una clave mal copiada sigue siendo una clave, y los errores acaban
 * en logs.
 */
export function requireApiKey(raw: string | undefined): string {
  const apiKey = raw?.trim();
  if (!apiKey) {
    throw new AnalysisConfigError(
      `Falta la variable de entorno ${GEMINI_API_KEY_ENV}. Consíguela en https://aistudio.google.com/apikey.`,
      GEMINI_API_KEY_ENV,
    );
  }
  return apiKey;
}

/**
 * Lo que el SDK necesita para hablar con Google, construido al primer uso.
 *
 * Perezoso por lo mismo que los clientes del backend: nada se construye al
 * importar el módulo, así que la app sigue renderizando aunque falte la API
 * key hasta que de verdad haya que generar un Análisis.
 */
function createSdkCall(): GenerateAnalysisObject {
  let model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null = null;

  function resolveModel() {
    if (model) return model;

    // Se lee aquí y no al construir el proveedor para que `name` y `model`
    // —lo que se guarda con el Análisis— estén disponibles siempre, incluso en
    // un entorno sin credenciales. Un constructor que lanza dejaría al
    // diagnóstico sin nada que decir.
    const apiKey = requireApiKey(process.env.GEMINI_API_KEY);

    model = createGoogleGenerativeAI({ apiKey })(AI_CONFIG.geminiModel);
    return model;
  }

  return async (prompt) => {
    const result = await generateObject({
      model: resolveModel(),
      /**
       * El schema hace DOS trabajos aquí, y solo uno de ellos es validar: el
       * SDK lo traduce a JSON Schema y se lo manda al modelo como contrato de
       * salida. Lo que no viaja en esa traducción son los `refine` —un ciclo
       * de bloqueos no se puede expresar en JSON Schema—, así que el modelo no
       * se entera de esas reglas y hay que seguir comprobándolas al volver.
       */
      schema: analysisSchema,
      schemaName: "Analisis",
      schemaDescription:
        "El Análisis de un árbol de ideas: Intención, resumen, preguntas, Spec y Tickets con Checks.",
      prompt,
      maxRetries: AI_CONFIG.maxRetries,
      /**
       * Por `abortSignal` y no por la opción `timeout` del SDK porque
       * `generateObject` no la acepta —la excluye de su firma—, así que el
       * reloj lo pone quien llama. `AbortSignal.timeout` lanza con
       * `name: "TimeoutError"`, que es lo que `errors.ts` reconoce.
       */
      abortSignal: AbortSignal.timeout(AI_CONFIG.timeoutMs),
    });

    return result.object;
  };
}

/**
 * El adaptador.
 *
 * @param generate solo para tests: sustituye la llamada al SDK por un doble.
 *   Es lo que permite verificar el mapeo de 429 / timeout / red / malformada
 *   sin gastar una sola petición de cuota real.
 */
export function createGeminiProvider(
  generate: GenerateAnalysisObject = createSdkCall(),
): AnalysisProvider {
  return {
    name: GEMINI_PROVIDER_NAME,
    model: AI_CONFIG.geminiModel,

    async analyze(request: AnalysisPromptInput): Promise<Analysis> {
      try {
        const raw = await generate(buildAnalysisPrompt(request));

        /**
         * El `.parse` DENTRO del `try`, y a sabiendas de que el SDK ya validó
         * contra el mismo schema.
         *
         * La redundancia es la decisión. El puerto promete que lo que cruza
         * esta frontera cumple el contrato, y el ADR 0003 promete que un
         * Análisis que no valida no se persiste nunca: las dos promesas son
         * nuestras, así que la comprobación que las sostiene tiene que ser
         * código nuestro y no un detalle interno del SDK que un cambio de
         * versión puede relajar. De paso es lo que hace que el doble de test
         * pase por la misma frontera que el modelo de verdad.
         *
         * Dentro del `try` para que un fallo de validación salga por
         * `normalizeGeminiError` igual que un JSON corrupto — el mismo camino,
         * que es literalmente el criterio del ticket.
         */
        return analysisSchema.parse(raw);
      } catch (error) {
        throw normalizeGeminiError(error);
      }
    },
  };
}
