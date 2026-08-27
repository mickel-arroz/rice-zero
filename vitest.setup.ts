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
