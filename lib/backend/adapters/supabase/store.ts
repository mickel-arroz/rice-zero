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
  asRelation,
  asRows,
  asWritePayload,
  createRunner,
  escapeLike,
  filteredId,
} from "@/lib/backend/adapters/postgrest/response";
import type { Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import type { SupabaseBrowserClient } from "@/lib/backend/adapters/supabase/client";

// Sin `recover`: el SDK de Supabase no lanza por falta de sesión, manda la
// petición y el motor contesta con PGRST301.
const { run, runCount } = createRunner();

export function createSupabaseRowStore(client: SupabaseBrowserClient): RowStore {
  return {
    async select(source, options) {
      let query = client.from(asRelation(source)).select("*");
      for (const filter of options?.where ?? []) {
        query = query.eq(filter.column, filter.value);
      }
      for (const order of options?.order ?? []) {
        query = query.order(order.column, {
          ascending: order.ascending,
          nullsFirst: order.nullsFirst,
        });
      }
      return asRows(await run(query, source, filteredId(options?.where)));
    },

    async count(source, where) {
      // `head: true` es lo que hace que esto valga la pena: la petición sale
      // como un HEAD y el motor devuelve la cuenta en una cabecera SIN mandar
      // una sola fila. Contar leyendo el árbol entero para hacerle `.length`
      // costaba el árbol entero por el cable para enseñar un número.
      let query = client.from(asRelation(source)).select("id", {
        count: "exact",
        head: true,
      });
      for (const filter of where ?? []) {
        query = query.eq(filter.column, filter.value);
      }
      return runCount(query, source, filteredId(where));
    },

    async searchNodes(term, limit) {
      // `ilike` con los comodines puestos aquí, y el término escapado antes:
      // un `%` o un `_` escritos por una persona son texto que quiere
      // encontrar, no comodines que quiera usar. Sin escaparlos, buscar «100%»
      // devolvería medio árbol.
      const rows = await run(
        client
          .from("nodes")
          .select("*, project_versions!inner(id, version_number, label, projects!inner(id, title))")
          .ilike("content", `%${escapeLike(term)}%`)
          // Los más recientes primero: entre dos Nodos que dicen lo mismo, el
          // que se escribió hace un rato es casi siempre el que se busca.
          .order("updated_at", { ascending: false })
          .limit(limit),
        "nodes",
        null,
      );
      return asRows(rows);
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

    async createProjectWithVersion(title, description, icon) {
      const data = await run(
        client.rpc("create_project_with_version", {
          p_title: title,
          p_description: description,
          p_icon: icon,
        }),
        "projects",
        null,
      );
      return data as Row;
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
