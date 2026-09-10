/**
 * El adaptador de Neon en el NAVEGADOR. El activo.
 *
 * Ya solo aporta la mitad de auth. Los repositorios los pone el adaptador HTTP
 * desde `lib/backend/index.ts`, porque desde el ADR 0006 los datos no dependen
 * del proveedor en este lado del cable: quien sabe que hay Neon detrás es el
 * servidor (`adapters/neon/server.ts`).
 */

import { createNeonAuthProvider } from "@/lib/backend/adapters/neon/auth";
import { getNeonClient } from "@/lib/backend/adapters/neon/client";
import type { AuthProvider } from "@/lib/backend/ports";

// Solo por su efecto en el typecheck: prueba que los tipos generados siguen
// describiendo el esquema que el núcleo compartido espera. Se importa desde
// aquí y no desde la mitad de servidor porque este módulo entra siempre en el
// bundle, y es lo que garantiza que la comprobación no se caiga de la build.
import "@/lib/backend/adapters/neon/schema-check";

export function createNeonAuth(): AuthProvider {
  return createNeonAuthProvider(getNeonClient());
}
