/**
 * El borde del SDK: lo que ambos adaptadores hacen igual a los dos lados de una
 * llamada a PostgREST.
 *
 * No importa ningún SDK. A la ida, adaptar la fila genérica del núcleo al tipo
 * que el cliente exige; a la vuelta, traducir `{ data, error }` a entidades o a
 * errores del puerto. Las dos cosas son iguales en los dos proveedores porque la
 * forma y los códigos son del motor. Lo que sí es de cada uno —qué cliente
 * construye la consulta y qué lanza su SDK antes de salir a la red— se queda en
 * su `store.ts`.
 */

import type { PostgrestFailure } from "@/lib/backend/adapters/postgrest/errors";
import {
  translatePostgrestFailure,
  translateThrown,
} from "@/lib/backend/adapters/postgrest/errors";
import { RESOURCE, type SourceName } from "@/lib/backend/adapters/postgrest/rows";
import type { Row } from "@/lib/backend/adapters/postgrest/store";

/** La respuesta de PostgREST, reducida a lo que se mira. */
export type PostgrestResponse = {
  data: unknown;
  error: PostgrestFailure | null;
  /** Solo cuando la consulta pidió `count`. Ver `runCount`. */
  count?: number | null;
};

export function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

/**
 * Adapta una fila genérica al tipo `Insert`/`Update` que el SDK exige.
 *
 * El núcleo trabaja con filas sin tipar por diseño y los SDKs piden el tipo
 * exacto de la tabla, que en el store llega como unión de las cuatro. Devuelve
 * `never` porque es el único tipo asignable a esa unión: no es una promesa de
 * que no retorne, es la forma de decirle al compilador «aquí la comprobación la
 * hace otro».
 *
 * Ese otro es `rows.ts` (el contrato de columnas) más el `schema-check.ts` de
 * cada adaptador, que rompe el typecheck si los tipos generados dejan de encajar
 * con él. Es el único cast del camino de escritura; los del camino de lectura
 * están en `mapping.ts`, respaldados por el mismo contrato.
 */
export function asWritePayload(values: Row): never {
  return values as unknown as never;
}

/**
 * Adapta el nombre de la fuente al literal que el SDK exige en `from()`.
 *
 * Hermana de `asWritePayload`, y por la misma razón: el núcleo lee de una unión
 * de tablas y de la vista, mientras que `from()` está SOBRECARGADO —una firma
 * por relación—, y TypeScript no resuelve una sobrecarga con un argumento que
 * es la unión de varias. La comprobación no desaparece, se mueve: la hace
 * `rows.ts` más el `schema-check.ts` de cada adaptador, que rompen el typecheck
 * si el nombre deja de existir en el esquema.
 */
export function asRelation(source: SourceName): never {
  return source as unknown as never;
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
  async function settle(
    query: PromiseLike<PostgrestResponse>,
    source: SourceName,
    id: string | null,
  ): Promise<PostgrestResponse> {
    let response: PostgrestResponse;
    try {
      response = await query;
    } catch (error) {
      throw recover?.(error) ?? translateThrown(error);
    }
    if (response.error) {
      // `recover` primero también aquí: hay SDKs que no lanzan su error propio
      // sino que lo dejan en `error`, y entonces llega sin código de motor y se
      // reportaría como fallo de red. Fue el caso de `AuthRequiredError` de
      // Neon, que salía como «problema de red» en vez de «no hay sesión».
      throw (
        recover?.(response.error) ??
        translatePostgrestFailure(response.error, RESOURCE[source], id)
      );
    }
    return response;
  }

  return {
    /** Lo normal: las filas. */
    async run(
      query: PromiseLike<PostgrestResponse>,
      source: SourceName,
      id: string | null,
    ): Promise<unknown> {
      return (await settle(query, source, id)).data;
    },

    /**
     * La CUENTA que viene en la cabecera, sin filas.
     *
     * Existe aparte y no como un caso de `run` porque lo que devuelve está en
     * otro sitio de la respuesta: PostgREST manda el total en `Content-Range` y
     * los SDKs lo dejan en `count`, no en `data` —que con `head: true` viene
     * vacío a propósito, que es justo de lo que se trata—.
     *
     * `?? 0`: sin `Prefer: count` la cabecera no viene. No debería pasar —quien
     * llama siempre la pide— pero devolver cero es mejor que un `NaN` viajando
     * hasta una frase de un diálogo de borrado.
     */
    async runCount(
      query: PromiseLike<PostgrestResponse>,
      source: SourceName,
      id: string | null,
    ): Promise<number> {
      return (await settle(query, source, id)).count ?? 0;
    },
  };
}

/** El id por el que se filtró, si se filtró por uno. Solo para el error. */
export function filteredId(
  where: { column: string; value: string | number }[] | undefined,
): string | null {
  const value = where?.find((filter) => filter.column === "id")?.value;
  return value === undefined ? null : String(value);
}

/**
 * Lo que una persona escribió, listo para meter en un patrón `like`.
 *
 * `%` y `_` son comodines de SQL, y los dos se teclean: alguien que busca
 * «100%» o «snake_case» está buscando ESO, no «cualquier cosa». Sin escaparlos,
 * la primera devolvería medio árbol y la segunda encontraría «snakeXcase».
 *
 * Vive aquí, con el resto de lo que no depende del SDK, porque lo usan los dos
 * adaptadores: es del protocolo, no del proveedor.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}
