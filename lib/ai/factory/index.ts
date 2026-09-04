/**
 * El interruptor del Proveedor de IA.
 *
 * Una variable decide cuál está activo. Cambiarla y redesplegar es todo lo que
 * hace falta para pasar de Gemini al proveedor falso y al revés: nada fuera de
 * este archivo sabe cuál es. Mismo criterio que `lib/backend/index.ts`, mapa
 * estático incluido — un `import()` dinámico dejaría al adaptador dormido
 * fuera del typecheck, y entonces «volver es cambiar una variable» sería
 * mentira.
 *
 * ¿Por qué en un subdirectorio y no en `lib/ai/factory.ts`? Porque los
 * archivos sueltos de `lib/ai/` son el CONTRATO —schema, prompt, renderer,
 * puerto, errores— y ESLint los tiene prohibido leer credenciales o importar
 * un SDK. Esto no es contrato: es cableado, y lee `process.env`. La regla que
 * lo separa está en `eslint.config.mjs` y es la misma que deja al adaptador de
 * Gemini importar su SDK.
 *
 * `server-only` porque de aquí sale el adaptador que lee la API key. Y por eso
 * `lib/ai/index.ts` NO reexporta este módulo: la puerta de la capa de IA la
 * cruza también el navegador —el renderer se usa en el panel— y reexportar la
 * fábrica arrastraría el SDK de Google a un bundle de cliente.
 */

import "server-only";

import { createGeminiProvider } from "@/lib/ai/adapters/gemini";
import { AnalysisConfigError } from "@/lib/ai/errors";
import type { AnalysisProvider } from "@/lib/ai/port";
import { fakeAnalysisProvider } from "@/lib/ai/testing/fake";

export const AI_PROVIDER_ENV_KEY = "AI_PROVIDER";

/**
 * Los proveedores que hay.
 *
 * El falso está en la lista y no escondido tras un `NODE_ENV === "test"`, y es
 * deliberado: la suite E2E y un desarrollador que quiere trabajar en la
 * interfaz del panel sin quemar el free tier lo necesitan seleccionable a
 * mano. Un interruptor que decide solo, mirando el entorno, es el que un día
 * decide mal en producción sin que nadie lo haya escrito en ningún sitio.
 */
export const AI_PROVIDER_NAMES = ["gemini", "falso"] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

const ADAPTERS: Record<AiProviderName, () => AnalysisProvider> = {
  gemini: createGeminiProvider,
  falso: fakeAnalysisProvider,
};

function isProviderName(value: string): value is AiProviderName {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
}

/**
 * Qué proveedor pide el entorno.
 *
 * @throws AnalysisConfigError si la variable falta o nombra uno que no existe.
 *
 * Sin default, y esta es LA decisión del archivo. Caer al falso cuando la
 * variable falta sería lo cómodo y lo peor que puede pasar: un despliegue al
 * que se le olvidó la variable serviría Análisis inventados —con su Spec, sus
 * Tickets y sus Checks, todos falsos— y el usuario no tendría forma de
 * distinguirlos de los buenos. Un error de configuración se ve; un Análisis de
 * mentira que parece bueno, no.
 */
export function readAnalysisProviderName(): AiProviderName {
  const raw = process.env[AI_PROVIDER_ENV_KEY]?.trim();
  if (!raw) {
    throw new AnalysisConfigError(
      `Falta la variable de entorno ${AI_PROVIDER_ENV_KEY}. Ponla a uno de: ${AI_PROVIDER_NAMES.join(", ")}.`,
      AI_PROVIDER_ENV_KEY,
    );
  }
  if (!isProviderName(raw)) {
    throw new AnalysisConfigError(
      `«${raw}» no es un Proveedor de IA. Los que hay: ${AI_PROVIDER_NAMES.join(", ")}.`,
      AI_PROVIDER_ENV_KEY,
    );
  }
  return raw;
}

let active: AnalysisProvider | null = null;

/**
 * El Proveedor de IA activo.
 *
 * Perezoso y memoizado igual que el del backend: nada se construye al importar
 * el módulo, para que la app siga renderizando aunque falte configuración
 * hasta que de verdad haya que generar un Análisis.
 */
export function getAnalysisProvider(): AnalysisProvider {
  if (active) return active;
  active = ADAPTERS[readAnalysisProviderName()]();
  return active;
}

/** Solo para tests: obliga a releer el interruptor. */
export function resetAnalysisProvider(): void {
  active = null;
}
