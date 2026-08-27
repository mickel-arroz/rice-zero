/**
 * Lo que ambos adaptadores hacen igual con una respuesta de PostgREST.
 *
 * No importa ningún SDK: los dos devuelven la misma forma `{ data, error }` y
 * los mismos códigos, porque son del motor. Lo que sí es de cada proveedor —qué
 * cliente construye la consulta y qué lanza su SDK antes de salir a la red— se
 * queda en su `store.ts`.
 */

import type { PostgrestFailure } from "@/lib/backend/adapters/postgrest/errors";
import {
  translatePostgrestFailure,
  translateThrown,
} from "@/lib/backend/adapters/postgrest/errors";
import type { TableName } from "@/lib/backend/adapters/postgrest/rows";
import type { Row } from "@/lib/backend/adapters/postgrest/store";

/** La respuesta de PostgREST, reducida a lo que se mira. */
export type PostgrestResponse = { data: unknown; error: PostgrestFailure | null };

/**
 * Qué recurso nombra un `NotFoundError` que venga de esta tabla. En el puerto
 * los nombres son de dominio, no de tabla.
 */
export const RESOURCE: Record<TableName, string> = {
  projects: "el Proyecto",
  project_versions: "la Versión",
  nodes: "el Nodo",
  ai_analyses: "el Análisis",
};

export function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

/**
 * El núcleo manda filas genéricas y los SDKs piden el tipo `Insert`/`Update`
 * exacto de la tabla, que en el store llega como unión de las cuatro. Este es el
 * único cast de la capa, y lo que lo respalda es `rows.ts` (el contrato de
 * columnas) más el `schema-check.ts` de cada adaptador, que rompe el typecheck
 * si los tipos generados dejan de encajar con él.
 */
export function untyped(values: Row): never {
  return values as unknown as never;
}

/**
 * Traduce lo que un SDK lanza ANTES de que el motor conteste. Devolver `null`
 * significa «no lo reconozco», y entonces es un fallo de transporte.
 */
export type RecoverThrown = (error: unknown) => Error | null;

/**
 * Construye el envoltorio que usa el store: nada sale de un adaptador sin pasar
 * por aquí, así que nada sale sin traducir a la taxonomía del puerto.
 */
export function createRunner(recover?: RecoverThrown) {
  return async function run(
    query: PromiseLike<PostgrestResponse>,
    table: TableName,
    id: string | null,
  ): Promise<unknown> {
    let response: PostgrestResponse;
    try {
      response = await query;
    } catch (error) {
      throw recover?.(error) ?? translateThrown(error);
    }
    if (response.error) {
      throw translatePostgrestFailure(response.error, RESOURCE[table], id);
    }
    return response.data;
  };
}

/** El id por el que se filtró, si se filtró por uno. Solo para el error. */
export function filteredId(
  where: { column: string; value: string | number }[] | undefined,
): string | null {
  const value = where?.find((filter) => filter.column === "id")?.value;
  return value === undefined ? null : String(value);
}
