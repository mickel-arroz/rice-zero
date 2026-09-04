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
 * la fábrica, y hay un test que lo afirma.
 *
 * Lo que queda aquí es cómo se arma la llamada y en qué orden se prueban los
 * modelos. Clasificar los fallos y decidir si uno justifica pasar al siguiente
 * es `errors.ts`; el prompt es `lib/ai/prompt.ts`; la forma de la respuesta es
 * `lib/ai/schema.ts`; y el ORDEN de los modelos es `lib/constants.ts`. Este
 * archivo no decide ninguna de las cuatro.
 */

import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";

import {
  GEMINI_API_KEY_ENV,
  normalizeGeminiError,
  shouldTryAnotherModel,
} from "@/lib/ai/adapters/gemini/errors";
import {
  AnalysisConfigError,
  AnalysisTimeoutError,
  type AnalysisError,
} from "@/lib/ai/errors";
import type { AnalysisOutcome, AnalysisProvider } from "@/lib/ai/port";
import { buildAnalysisPrompt, type AnalysisPromptInput } from "@/lib/ai/prompt";
import { analysisSchema } from "@/lib/ai/schema";
import { AI_CONFIG } from "@/lib/constants";

/** Cómo se llama este adaptador. Va a `ai_analyses` con cada Análisis. */
export const GEMINI_PROVIDER_NAME = "gemini";

/** Cuando `geminiModels` llegó vacía: es configuración, no un fallo del modelo. */
const NO_MODELS =
  "No hay ningún modelo de Gemini configurado. Revisa AI_CONFIG.geminiModels.";

/**
 * Una llamada al modelo. Lo que el modelo devolvió, sin validar todavía.
 *
 * Es el ÚNICO punto del adaptador que sale a la red, y por eso es el punto por
 * el que se inyecta en los tests. Toma el modelo y el tiempo que le queda como
 * PARÁMETROS, no de la configuración: es lo que permite que un doble de test
 * afirme en qué orden se probaron los modelos y con cuánto presupuesto, que es
 * justo lo que hay que probar de una cadena de reserva.
 *
 * Devuelve `unknown` a propósito: quien lo implemente —el SDK o un doble— no
 * promete nada sobre la forma, y la promesa la hace el `.parse` de abajo.
 */
export type GenerateAnalysisObject = (
  prompt: string,
  model: string,
  timeoutMs: number,
) => Promise<unknown>;

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
 * La llamada de verdad, contra Google.
 *
 * El cliente se construye una vez y sirve para todos los modelos: la API key es
 * la misma, y lo único que cambia entre eslabones de la cadena es el id. Se
 * construye al PRIMER uso, no al importar el módulo, para que la app siga
 * renderizando aunque falte la key hasta que de verdad haya que generar.
 */
function createSdkCall(): GenerateAnalysisObject {
  let google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

  return async (prompt, model, timeoutMs) => {
    google ??= createGoogleGenerativeAI({
      apiKey: requireApiKey(process.env.GEMINI_API_KEY),
    });

    const result = await generateObject({
      model: google(model),
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
       * reloj lo pone quien llama. Y el plazo es lo que QUEDA del presupuesto
       * compartido, no el presupuesto entero: si no, cinco modelos a dos
       * minutos serían diez minutos de peor caso.
       *
       * `AbortSignal.timeout` lanza con `name: "TimeoutError"`, que es lo que
       * `errors.ts` reconoce.
       */
      abortSignal: AbortSignal.timeout(timeoutMs),
    });

    return result.object;
  };
}

/**
 * El adaptador.
 *
 * @param generate solo para tests: sustituye la llamada al SDK por un doble.
 *   Es lo que permite verificar el mapeo de errores y el orden de la cadena sin
 *   gastar una sola petición de cuota real.
 */
export function createGeminiProvider(
  generate: GenerateAnalysisObject = createSdkCall(),
): AnalysisProvider {
  return {
    name: GEMINI_PROVIDER_NAME,
    models: AI_CONFIG.geminiModels,

    async analyze(request: AnalysisPromptInput): Promise<AnalysisOutcome> {
      // Se ensambla UNA vez, fuera del bucle: el prompt no depende del modelo,
      // y rearmarlo por intento invitaría a que algún día sí dependiera.
      const prompt = buildAnalysisPrompt(request);

      /**
       * El presupuesto es de la generación entera y no de cada intento.
       *
       * Es lo que hace viable una cadena de cinco modelos: cada uno se lleva lo
       * que queda, y el conjunto no puede pasarse de `timeoutMs`. Con un plazo
       * por intento, el peor caso serían cinco veces el plazo — muy por encima
       * de cualquier `maxDuration` de plataforma, y el usuario vería el corte
       * de la plataforma en vez del nuestro.
       */
      const deadline = Date.now() + AI_CONFIG.timeoutMs;

      /** El último fallo clasificado, para poder rendirse diciendo por qué. */
      let last: AnalysisError | null = null;

      for (const model of AI_CONFIG.geminiModels) {
        const remaining = deadline - Date.now();

        /**
         * Se para ANTES de llamar si no queda tiempo útil.
         *
         * Sin esto, la cadena podía lanzar una petición con 200 ms de
         * presupuesto: garantizada a morir por timeout, y contada por Google
         * igual que cualquier otra. Una llamada de cuota tirada a cambio de
         * nada.
         *
         * El fallo que sale es un timeout y no `last`, y la diferencia importa:
         * si se acabó el reloj, eso es lo que pasó — decir «high demand»
         * porque fue el último error visto mandaría a mirar al sitio
         * equivocado. `last` viaja en `cause`.
         */
        if (remaining < AI_CONFIG.minAttemptMs) {
          throw new AnalysisTimeoutError({ cause: last });
        }

        try {
          const raw = await generate(prompt, model, remaining);

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
           * `normalizeGeminiError` igual que un JSON corrupto — el mismo
           * camino, que es literalmente el criterio del ticket. Y para que la
           * cadena lo VEA: una respuesta malformada no pasa al siguiente
           * modelo, y esa decisión no se puede tomar si el error se escapa por
           * fuera del bucle.
           */
          return { analysis: analysisSchema.parse(raw), model };
        } catch (error) {
          last = normalizeGeminiError(error);

          // Y aquí está la cadena entera: si el fallo no tiene pinta de ser
          // culpa DE ESTE modelo, cambiar de modelo no arregla nada, así que se
          // sale con el error honesto en vez de quemar la lista.
          if (!shouldTryAnotherModel(last)) throw last;
        }
      }

      // La lista se agotó. `last` está puesto salvo que la lista viniera vacía,
      // y eso no es un fallo del modelo sino configuración nuestra.
      throw last ?? new AnalysisConfigError(NO_MODELS);
    },
  };
}
