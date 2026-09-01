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

const noVendorSdks = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: allSdkPatterns,
          message:
            "Un SDK de proveedor solo se importa dentro de lib/backend/adapters/<proveedor>/. Fuera, usa el puerto (@/lib/backend).",
        },
      ],
    },
  ],
};

const noAdapterImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: allSdkPatterns,
          message:
            "Un SDK de proveedor solo se importa dentro de lib/backend/adapters/<proveedor>/. Fuera, usa el puerto (@/lib/backend).",
        },
        {
          group: ["@/lib/backend/adapters", "@/lib/backend/adapters/**"],
          message:
            "Los adaptadores son detalle interno de lib/backend/. Llama a getBackend() y habla con el puerto.",
        },
      ],
    },
  ],
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
 * Solo alcanza a los archivos SUELTOS de `lib/ai/`. Un futuro
 * `lib/ai/adapters/gemini/` queda fuera a propósito: ahí es donde el SDK va.
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
    files: ["lib/ai/*.ts"],
    // Los tests importan `vitest`, que no es ni Zod ni código del repo.
    ignores: ["lib/ai/*.test.ts"],
    rules: noNetworkInAi,
  },
  adapterOverride("neon"),
  adapterOverride("supabase"),
]);

export default eslintConfig;
