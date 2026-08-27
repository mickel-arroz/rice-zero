/**
 * `RowStore` sobre PostgREST de Supabase.
 *
 * Es la única capa que toca el SDK de Supabase. Lo que no depende del SDK
 * —traducir la respuesta, nombrar el recurso, el cast de la fila— vive en
 * `postgrest/response.ts`, compartido con el otro adaptador porque los códigos y
 * la forma `{ data, error }` son del motor y no del proveedor.
 *
 * Lo que queda aquí es solo cómo se arma la consulta, y eso sí es del SDK.
 */

import {
  asRows,
  asWritePayload,
  createRunner,
  filteredId,
} from "@/lib/backend/adapters/postgrest/response";
import type { Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import type { SupabaseBrowserClient } from "@/lib/backend/adapters/supabase/client";

// Sin `recover`: el SDK de Supabase no lanza por falta de sesión, manda la
// petición y el motor contesta con PGRST301.
const run = createRunner();

export function createSupabaseRowStore(client: SupabaseBrowserClient): RowStore {
  return {
    async select(table, options) {
      let query = client.from(table).select("*");
      for (const filter of options?.where ?? []) {
        query = query.eq(filter.column, filter.value);
      }
      for (const order of options?.order ?? []) {
        query = query.order(order.column, {
          ascending: order.ascending,
          nullsFirst: order.nullsFirst,
        });
      }
      return asRows(await run(query, table, filteredId(options?.where)));
    },

    async insert(table, values) {
      // `.select()` tras el insert: PostgREST no devuelve la fila si no se le
      // pide, y el puerto promete la entidad creada (con el id, el
      // `version_number` que puso el trigger y los timestamps del motor).
      const data = await run(
        client.from(table).insert(asWritePayload(values)).select().single(),
        table,
        null,
      );
      return data as Row;
    },

    async update(table, id, values) {
      // `maybeSingle` y no `single`: cero filas aquí significa «no existe o no
      // es tuyo», y eso es un `NotFoundError` que pone el núcleo, no un error
      // del motor.
      const data = await run(
        client.from(table).update(asWritePayload(values)).eq("id", id).select().maybeSingle(),
        table,
        id,
      );
      return (data as Row | null) ?? null;
    },

    async delete(table, id) {
      const data = await run(client.from(table).delete().eq("id", id).select(), table, id);
      return asRows(data).length > 0;
    },

    async cloneVersion(versionId, label) {
      const data = await run(
        client.rpc("clone_project_version", {
          p_version_id: versionId,
          p_label: label,
        }),
        "project_versions",
        versionId,
      );
      return (data as Row | null) ?? null;
    },
  };
}
