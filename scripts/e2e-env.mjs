/**
 * Qué variables exige la suite E2E.
 *
 * Vive en un `.mjs` y no dentro de `e2e/apoyo/entorno.ts` porque lo leen los
 * DOS lados: el guardia que corre antes de arrancar Playwright
 * (`scripts/e2e.mjs`, que es Node a pelo) y el módulo de TypeScript que usan la
 * configuración y las pruebas. Dos listas de variables obligatorias se
 * desincronizan en cuanto alguien añade una — y la que se quedara atrás sería
 * justo la que deja pasar una corrida a medio configurar.
 *
 * Mismo criterio que `scripts/env-local.mjs`, que también lo comparten los
 * scripts y el setup de Vitest.
 */

/**
 * El interruptor, aparte de las credenciales y por la misma razón que
 * `BACKEND_CONTRACT_LIVE`: la semilla BORRA los Proyectos de la cuenta antes de
 * cada corrida, y unas credenciales que estén en `.env.local` por otro motivo
 * no deben bastar para que eso empiece a pasar.
 */
export const E2E_SWITCH = "E2E_LIVE";

/**
 * Todo lo que la suite necesita, en el orden en que se echa en falta.
 *
 * `DATABASE_URL` está en la lista porque la semilla confirma el email y vacía
 * la cuenta por SQL con el rol dueño — lo mismo que hace
 * `npm run account:verify`. Sin ella no hay estado de partida reproducible, que
 * es un criterio del #20.
 */
export const E2E_KEYS = [
  E2E_SWITCH,
  "E2E_EMAIL",
  "E2E_PASSWORD",
  "DATABASE_URL",
];
