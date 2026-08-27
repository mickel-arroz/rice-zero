/**
 * El puerto del Proveedor de Backend.
 *
 * Todo lo que la app puede saber del backend entra por aquí. Ningún archivo de
 * este directorio importa un SDK de proveedor, y ESLint lo impide.
 */

export * from "@/lib/backend/ports/auth";
export * from "@/lib/backend/ports/entities";
export * from "@/lib/backend/ports/errors";
export * from "@/lib/backend/ports/provider";
export * from "@/lib/backend/ports/repositories";
export * from "@/lib/backend/ports/session";
