/**
 * `RowStore`: el almacén de filas que el núcleo compartido necesita.
 *
 * Es el seam que permite que Neon y Supabase compartan implementación sin que
 * el puerto lo note. El ADR rechaza un puerto con forma PostgREST porque eso
 * filtraría el protocolo a cada call site; esto no llega a ninguno — vive
 * entero detrás del puerto, y un adaptador que no hable PostgREST (Firebase)
 * simplemente no lo usa.
 *
 * Cada implementación traduce sus propios errores a la taxonomía del puerto
 * ANTES de devolver. El núcleo solo añade los errores que son de dominio y no
 * de transporte: `NotFoundError` cuando el motor no devolvió fila y
 * `ConflictError` cuando choca una regla.
 */

import type { TableName } from "@/lib/backend/adapters/postgrest/rows";

/** Una fila cruda, tal y como viaja por el cable. */
export type Row = Record<string, unknown>;

/**
 * Igualdad simple. Es todo lo que las consultas de RICE(0) necesitan.
 *
 * No admite `null`: en PostgREST comparar con nulo es `is`, no `eq`, y ninguna
 * consulta del dominio filtra por una columna nula — los árboles se piden por
 * Versión, nunca «los Nodos sin padre».
 */
export type Filter = {
  column: string;
  value: string | number;
};

export type Order = {
  column: string;
  ascending: boolean;
  /**
   * Dónde van los nulos. Explícito y no por defecto: Postgres los pone al final
   * en ascendente, y el árbol de una Versión se pide ordenado por `parent_id`
   * —donde nulo significa «raíz»—, así que dejarlo al motor pondría los hijos
   * antes que sus padres.
   */
  nullsFirst: boolean;
};

export interface RowStore {
  select(
    table: TableName,
    options?: { where?: Filter[]; order?: Order[] },
  ): Promise<Row[]>;

  /** Devuelve la fila insertada. */
  insert(table: TableName, values: Row): Promise<Row>;

  /** `null` cuando el motor no devolvió fila: no existe, o RLS la esconde. */
  update(table: TableName, id: string, values: Row): Promise<Row | null>;

  /** `false` cuando no se borró ninguna fila. */
  delete(table: TableName, id: string): Promise<boolean>;

  /** Clona una Versión. La única RPC del esquema. */
  cloneVersion(versionId: string, label: string | null): Promise<Row | null>;
}
