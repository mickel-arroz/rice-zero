/**
 * `server-only`, para Vitest.
 *
 * El paquete no está instalado y no hace falta que lo esté: Next lo resuelve él
 * mismo en tiempo de build, y su único trabajo es REVENTAR si el módulo que lo
 * importa acaba en un bundle de cliente. Es la marca que hace del criterio «la
 * API key no aparece en ningún bundle de cliente» un error de compilación en vez
 * de una intención.
 *
 * Vitest no es Next y no lo resuelve, así que sin este alias un test que importe
 * `lib/ai/adapters/gemini/` o `lib/backend/server.ts` falla al cargar el módulo
 * —no al afirmar nada— y el fallo no dice nada útil.
 *
 * Vacío a propósito. Aquí no hay frontera de cliente que proteger: el runner
 * corre en Node y todo es servidor.
 */

export {};
