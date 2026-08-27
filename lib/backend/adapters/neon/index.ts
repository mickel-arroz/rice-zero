/**
 * El adaptador de Neon. El activo.
 */

import { createNeonAuthProvider } from "@/lib/backend/adapters/neon/auth";
import { getNeonClient } from "@/lib/backend/adapters/neon/client";
import { createNeonRowStore } from "@/lib/backend/adapters/neon/store";
import { createRepositories } from "@/lib/backend/adapters/postgrest/kernel";
import type { BackendProvider } from "@/lib/backend/ports";

// Solo por su efecto en el typecheck: prueba que los tipos generados siguen
// describiendo el esquema que el núcleo compartido espera.
import "@/lib/backend/adapters/neon/schema-check";

export function createNeonBackend(): BackendProvider {
  const client = getNeonClient();
  return {
    name: "neon",
    auth: createNeonAuthProvider(client),
    ...createRepositories(createNeonRowStore(client)),
  };
}
