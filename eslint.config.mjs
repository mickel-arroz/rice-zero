import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Qué puede hablar con Supabase.
 *
 * `lib/supabase/` construye los clientes y `lib/services/` es la única capa
 * que los usa; todo lo demás (páginas, componentes, stores) recibe datos ya
 * resueltos por servicios tipados. La regla existe para que ese límite no
 * dependa de acordarse de él.
 */
const DATA_LAYER = ["lib/supabase/**", "lib/services/**"];

const noSupabaseOutsideDataLayer = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          // `@supabase/*` sola no ataja los imports profundos
          // (`@supabase/supabase-js/dist/…`), que son la vía de escape obvia.
          group: ["@supabase/*", "@supabase/*/**"],
          message:
            "Los SDKs de Supabase solo se importan en lib/supabase/ y lib/services/. Llama a un servicio tipado.",
        },
        {
          group: ["@/lib/supabase/client", "@/lib/supabase/server"],
          message:
            "Los clientes de Supabase son de la capa de servicios. Llama a un servicio tipado en lib/services/.",
        },
      ],
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
    rules: noSupabaseOutsideDataLayer,
  },
  {
    files: DATA_LAYER.map((path) => `${path}/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}`),
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
