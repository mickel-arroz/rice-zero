/**
 * Carga `.env.local` antes de los tests, igual que hace `next dev`.
 *
 * Existe por la corrida en vivo de la contract suite
 * (`lib/backend/testing/live.test.ts`), que necesita las credenciales del
 * proveedor activo. El resto de los tests no la necesita, y no le molesta: el
 * cargador nunca sobreescribe lo que ya venga del entorno.
 */

// El mismo cargador que usan `npm run verify:neon` y los demás scripts de
// esquema: una sola copia, para que el comportamiento no pueda divergir entre
// los tests y los scripts.
import { loadEnvLocal } from "./scripts/env-local.mjs";

loadEnvLocal();

/**
 * El Proveedor de IA de la corrida es SIEMPRE el falso.
 *
 * Se fuerza DESPUÉS de cargar `.env.local` y sin mirar lo que hubiera: es la
 * diferencia entre «los tests no suelen gastar cuota» y «los tests no pueden
 * gastar cuota». Quien tenga `AI_PROVIDER=gemini` en su `.env.local` para
 * trabajar en el panel no se encuentra con que `npm test` se le come el free
 * tier, y una corrida en CI no depende de que alguien se acordara de ponerla.
 *
 * La corrida en vivo (`gemini.live.test.ts`) no pasa por la fábrica: construye
 * el adaptador de Gemini directamente. Así esto puede ser absoluto sin dejar
 * sin probar al proveedor de verdad.
 */
process.env.AI_PROVIDER = "falso";
