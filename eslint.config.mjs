import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Los dos límites del Proveedor de Backend.
 *
 * 1. Un SDK de vendedor solo se importa dentro de `lib/backend/adapters/<n>/`.
 *    Es lo que hace que el adaptador sea el único código a tocar cuando el
 *    proveedor cambia (o se rompe: Managed Better Auth está en Beta).
 * 2. Un adaptador solo se importa desde dentro de `lib/backend/`. Fuera, la app
 *    habla con el puerto y con nada más — ni siquiera sabe cuál está activo.
 *
 * Ver `docs/adr/0001-proveedor-de-backend-intercambiable.md`. Las reglas existen
 * para que estos límites no dependan de acordarse de ellos.
 */

/** Un SDK por adaptador. Los imports profundos son la vía de escape obvia. */
const VENDOR_SDKS = {
  neon: ["@neondatabase/*", "@neondatabase/*/**", "better-auth", "better-auth/**"],
  supabase: ["@supabase/*", "@supabase/*/**"],
};

const allSdkPatterns = Object.values(VENDOR_SDKS).flat();

/**
 * El SDK de la capa de IA.
 *
 * Mismo trato que los del backend y por la misma razón, más una propia: de
 * `@ai-sdk/google` cuelga la lectura de la API key, así que un import suelto en
 * un componente no es solo una capa mal puesta — es una credencial en un bundle
 * de cliente, que es un criterio de aceptación del #15.
 *
 * `ai` a secas va por `paths` y no por `patterns`, y costó un rato: los
 * `group` de esta regla se evalúan con semántica de `.gitignore`, donde un
 * patrón SIN barra casa con cualquier segmento del camino. Así que `"ai"`
 * prohibía también `@/lib/ai/schema` — toda la capa se quedaba sin poder
 * importarse a sí misma. `paths` compara el nombre exacto del módulo, que es
 * lo que aquí se quiere; los subcaminos los cubre `ai/**`, que sí lleva barra
 * y por eso queda anclado al principio.
 */
const AI_SDK_PATTERNS = ["ai/**", "@ai-sdk/*", "@ai-sdk/*/**"];

const SDK_MESSAGE =
  "Un SDK de proveedor solo se importa dentro de lib/backend/adapters/<proveedor>/. Fuera, usa el puerto (@/lib/backend).";

const AI_SDK_MESSAGE =
  "El SDK de IA solo se importa dentro de lib/ai/adapters/gemini/. Fuera, usa el puerto (@/lib/ai) o la fábrica (@/lib/ai/factory).";

/** El nombre exacto del paquete raíz del SDK. Ver el comentario de arriba. */
const AI_SDK_PATH = { name: "ai", message: AI_SDK_MESSAGE };

const AI_ADAPTER_MESSAGE =
  "Los adaptadores de IA son detalle interno de lib/ai/. Llama a getAnalysisProvider() y habla con el puerto.";

const noVendorSdks = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        { group: allSdkPatterns, message: SDK_MESSAGE },
        // Lo prohibido es el SDK y los ADAPTADORES de IA, no la capa entera:
        // `ports/entities.ts` importa el TIPO del Análisis de `lib/ai/schema.ts`
        // a propósito, porque ese schema es la fuente de verdad de su forma y un
        // `type` paralelo se desincronizaría sin que el compilador se enterara.
        // Es un import de tipo, así que se borra al compilar. Lo que el backend
        // no puede es hablar con un modelo.
        { group: AI_SDK_PATTERNS, message: AI_SDK_MESSAGE },
        { group: ["@/lib/ai/adapters", "@/lib/ai/adapters/**"], message: AI_ADAPTER_MESSAGE },
      ],
      paths: [AI_SDK_PATH],
    },
  ],
};

const noAdapterImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        { group: allSdkPatterns, message: SDK_MESSAGE },
        {
          group: ["@/lib/backend/adapters", "@/lib/backend/adapters/**"],
          message:
            "Los adaptadores son detalle interno de lib/backend/. Llama a getBackend() y habla con el puerto.",
        },
        { group: AI_SDK_PATTERNS, message: AI_SDK_MESSAGE },
        { group: ["@/lib/ai/adapters", "@/lib/ai/adapters/**"], message: AI_ADAPTER_MESSAGE },
      ],
      paths: [AI_SDK_PATH],
    },
  ],
};

/**
 * Dentro de `lib/ai/` los adaptadores son código propio: la fábrica los
 * importa, y esa es justamente su razón de existir. Es la misma asimetría que
 * `noVendorSdks` concede a `lib/backend/`.
 *
 * El SDK sigue prohibido: quien lo levanta es el override del adaptador.
 */
const noSdksInAiLayer = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        { group: allSdkPatterns, message: SDK_MESSAGE },
        {
          group: ["@/lib/backend/adapters", "@/lib/backend/adapters/**"],
          message:
            "Los adaptadores son detalle interno de lib/backend/. Llama a getBackend() y habla con el puerto.",
        },
        { group: AI_SDK_PATTERNS, message: AI_SDK_MESSAGE },
      ],
      paths: [AI_SDK_PATH],
    },
  ],
};

/**
 * El adaptador de Gemini: su SDK sí, los del backend no.
 *
 * Sin la asimetría la regla sería «los SDKs se usan en adapters/», que dejaría
 * al adaptador de Gemini importar `@supabase/*` sin que nadie se enterara —
 * exactamente el agujero que `adapterOverride` tapa en el backend.
 */
const geminiAdapter = {
  files: ["lib/ai/adapters/gemini/**/*.{ts,tsx,mts,cts}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: allSdkPatterns, message: SDK_MESSAGE },
          {
            group: ["@/lib/backend/adapters", "@/lib/backend/adapters/**"],
            message:
              "Los adaptadores son detalle interno de lib/backend/. Llama a getBackend() y habla con el puerto.",
          },
        ],
      },
    ],
  },
};

/**
 * Un adaptador puede importar su propio SDK, y ninguno el del otro. Sin esta
 * asimetría la regla sería «los SDKs se usan en adapters/», que dejaría al
 * adaptador de Neon importar `@supabase/*` sin que nadie se enterara.
 */
function adapterOverride(adapter) {
  const others = Object.keys(VENDOR_SDKS).filter((name) => name !== adapter);
  const foreignSdks = others.flatMap((name) => VENDOR_SDKS[name]);
  const foreignAdapters = others.flatMap((name) => [
    `@/lib/backend/adapters/${name}`,
    `@/lib/backend/adapters/${name}/**`,
  ]);

  return {
    files: [`lib/backend/adapters/${adapter}/**/*.{ts,tsx,mts,cts}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: foreignSdks,
              message: `El adaptador de ${adapter} solo importa su propio SDK.`,
            },
            {
              group: foreignAdapters,
              message: `Los adaptadores no se hablan entre ellos. Lo común vive en lib/backend/adapters/postgrest/.`,
            },
          ],
        },
      ],
    },
  };
}

/**
 * El límite de la capa de IA: `lib/ai/` no toca red ni lee credenciales.
 *
 * Mismo criterio que el límite del Proveedor de Backend, y por la misma razón:
 * el schema, el prompt y el renderer son módulos puros contra los que se
 * construye el adaptador de Gemini (#23, #15), y el atajo natural cuando
 * aprieta es importar el SDK «solo para esto» en el módulo del prompt. La
 * regla existe para que ese atajo falle en el editor y no cuando la suite
 * empiece a pedir una API key.
 *
 * Solo alcanza a los archivos SUELTOS de `lib/ai/`. `lib/ai/adapters/gemini/`
 * queda fuera a propósito —ahí es donde el SDK va— y `lib/ai/factory/`
 * también, porque es quien lee `AI_PROVIDER` para elegir adaptador.
 */
const noNetworkInAi = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          // Lista blanca y no negra, escrita como regex porque es lo único
          // que expresa «todo menos esto»: Zod, que es quien fija la forma de
          // la respuesta, y código del propio repo. Lo demás —un SDK, un
          // cliente HTTP, `node:https`— significa que la frontera se movió.
          // Negra no serviría: el SDK de #15 todavía no se sabe cuál es.
          regex: "^(?!@/lib/|zod$)",
          message:
            "lib/ai/ es puro: solo importa Zod y código del repo. El SDK va en su adaptador.",
        },
      ],
    },
  ],
  "no-restricted-properties": [
    "error",
    {
      object: "process",
      property: "env",
      message:
        "lib/ai/ no lee credenciales: la API key es cosa del adaptador, no del contrato.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
    rules: noAdapterImports,
  },
  {
    // Dentro de lib/backend/ los adaptadores son código propio: el interruptor
    // los importa a los dos, y esa es justamente su razón de existir.
    files: ["lib/backend/**/*.{ts,tsx,mts,cts}"],
    rules: noVendorSdks,
  },
  {
    // Antes del override de los archivos sueltos, para que ese gane sobre este.
    files: ["lib/ai/**/*.{ts,tsx,mts,cts}"],
    rules: noSdksInAiLayer,
  },
  {
    files: ["lib/ai/*.ts"],
    // Los tests importan `vitest`, que no es ni Zod ni código del repo.
    ignores: ["lib/ai/*.test.ts"],
    rules: noNetworkInAi,
  },
  geminiAdapter,
  adapterOverride("neon"),
  adapterOverride("supabase"),
]);

export default eslintConfig;
