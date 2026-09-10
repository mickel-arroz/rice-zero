/**
 * `RowStore` sobre el Data API de Neon.
 *
 * Es la única capa que toca el SDK de Neon. Lo que no depende del SDK —traducir
 * la respuesta, nombrar el recurso, el cast de la fila— vive en
 * `postgrest/response.ts`, compartido con el otro adaptador porque los códigos y
 * la forma `{ data, error }` son del motor y no del proveedor.
 *
 * Lo que queda aquí es solo cómo se arma la consulta, y eso sí es del SDK.
 */

import { AuthRequiredError } from "@neondatabase/neon-js";

import type { NeonDataClient } from "@/lib/backend/adapters/neon/data";
import {
  asRelation,
  asRows,
  asWritePayload,
  createRunner,
  escapeLike,
  filteredId,
} from "@/lib/backend/adapters/postgrest/response";
import type { Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import { retryColdRead } from "@/lib/backend/adapters/postgrest/warmup";
import { UnauthenticatedError } from "@/lib/backend/ports";

/**
 * El SDK de Neon no espera a que el motor conteste: si no hay token que
 * inyectar, lanza antes de salir a la red. Es una sesión que falta, no un fallo
 * de transporte.
 */
const { run, runCount } = createRunner((error) =>
  error instanceof AuthRequiredError
    ? new UnauthenticatedError(error.message, { cause: error })
    : null,
);

/**
 * ¿Es el tropiezo de sesión del Data API?
 *
 * Neon establece la sesión JWT sobre una conexión de su pool, y de vez en
 * cuando la PRIMERA escritura llega antes de que esa sesión esté puesta:
 * `auth.uid()` sale nulo, `owner_id` se queda sin dueño y la política lo
 * rechaza con un 42501. La misma petición, con el mismo token y el mismo
 * cuerpo, funciona al segundo intento — así lo reprodujo la corrida en vivo y
 * así lo vio el navegador.
 *
 * Se distingue por el MENSAJE y no solo por el código, y la diferencia importa:
 * «permission denied for table» sería un GRANT que falta —un fallo nuestro, que
 * reintentar no arregla— mientras que «new row violates row-level security
 * policy» con un token válido solo puede ser esto.
 */
function isSessionHiccup(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string; message?: string } })
    ?.cause;
  return (
    cause?.code === "42501" &&
    /row[- ]level security/i.test(cause.message ?? "")
  );
}

export function createNeonRowStore(client: NeonDataClient): RowStore {
  /**
   * Una escritura, y un segundo intento si fue el tropiezo de arriba.
   *
   * Reintentar una escritura solo es seguro porque un rechazo de RLS aborta la
   * sentencia: no se escribió nada, así que no hay forma de duplicar un
   * Proyecto.
   *
   * No envuelve a las LECTURAS, y no porque estén a salvo: allí el mismo
   * tropiezo no da error, da 200 con cero filas. De ésas se ocupa
   * `retryColdRead`, en el núcleo compartido, que reintenta por vacío además de
   * por error.
   *
   * Uno y no un bucle: si el segundo intento también choca, es que no era esto.
   */
  async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!isSessionHiccup(error)) throw error;
      // Se tira el token cacheado de paso: no consta que sea la causa, pero el
      // reintento tiene que ser el intento más limpio posible.
      client.forgetToken();
      return operation();
    }
  }

  return {
    async select(source, options) {
      const build = () => {
        let query = client.data.from(asRelation(source)).select("*");
        for (const filter of options?.where ?? []) {
          query = query.eq(filter.column, filter.value);
        }
        for (const order of options?.order ?? []) {
          query = query.order(order.column, {
            ascending: order.ascending,
            nullsFirst: order.nullsFirst,
          });
        }
        return run(query, source, filteredId(options?.where));
      };

      return asRows(
        await retryColdRead(build, (data) => asRows(data).length === 0),
      );
    },

    async count(source, where) {
      // `head: true` es lo que hace que esto valga la pena: la petición sale
      // como un HEAD y el motor devuelve la cuenta en una cabecera SIN mandar
      // una sola fila. Contar leyendo el árbol entero para hacerle `.length`
      // costaba el árbol entero por el cable para enseñar un número.
      //
      // Y pasa por el mismo reintento que `select`: una cuenta también sale a
      // cero cuando RLS no casa, y de ahí cuelga la frase de un diálogo de
      // borrado — «se lleva 0 Nodos por delante» sobre un árbol de ciento
      // veintiséis es peor que no decir nada.
      const build = () => {
        let query = client.data.from(asRelation(source)).select("id", {
          count: "exact",
          head: true,
        });
        for (const filter of where ?? []) {
          query = query.eq(filter.column, filter.value);
        }
        return runCount(query, source, filteredId(where));
      };

      return retryColdRead(build, (total) => total === 0);
    },

    async searchNodes(term, limit) {
      // `ilike` con los comodines puestos aquí, y el término escapado antes:
      // un `%` o un `_` escritos por una persona son texto que quiere
      // encontrar, no comodines que quiera usar. Sin escaparlos, buscar «100%»
      // devolvería medio árbol.
      const build = () =>
        run(
          client.data
            .from("nodes")
            .select(
              "*, project_versions!inner(id, version_number, label, projects!inner(id, title))",
            )
            .ilike("content", `%${escapeLike(term)}%`)
            // Los más recientes primero: entre dos Nodos que dicen lo mismo, el
            // que se escribió hace un rato es casi siempre el que se busca.
            .order("updated_at", { ascending: false })
            .limit(limit),
          "nodes",
          null,
        );

      // También la Búsqueda: una que no encuentra nada y una que no vio nada
      // por RLS se leen igual desde aquí, y la segunda es un fallo.
      return asRows(
        await retryColdRead(build, (data) => asRows(data).length === 0),
      );
    },

    async insert(table, values) {
      // `.select()` tras el insert: PostgREST no devuelve la fila si no se le
      // pide, y el puerto promete la entidad creada (con el id, el
      // `version_number` que puso el trigger y los timestamps del motor).
      const data = await retryOnce(() =>
        run(
          client.data
            .from(table)
            .insert(asWritePayload(values))
            .select()
            .single(),
          table,
          null,
        ),
      );
      return data as Row;
    },

    async update(table, id, values) {
      // `maybeSingle` y no `single`: cero filas aquí significa «no existe o no
      // es tuyo», y eso es un `NotFoundError` que pone el núcleo, no un error
      // del motor.
      const data = await run(
        client.data
          .from(table)
          .update(asWritePayload(values))
          .eq("id", id)
          .select()
          .maybeSingle(),
        table,
        id,
      );
      return (data as Row | null) ?? null;
    },

    async delete(table, id) {
      const data = await run(
        client.data.from(table).delete().eq("id", id).select(),
        table,
        id,
      );
      return asRows(data).length > 0;
    },

    async createProjectWithVersion(title, description, icon) {
      const data = await retryOnce(() =>
        run(
          client.data.rpc("create_project_with_version", {
            p_title: title,
            p_description: description,
            p_icon: icon,
          }),
          "projects",
          null,
        ),
      );
      return data as Row;
    },

    async cloneVersion(versionId, label) {
      // Una RPC también evalúa RLS: sin `auth.uid()` no encuentra la Versión de
      // origen y devuelve `null`, que el núcleo traduce a «no existe». Con el
      // token todavía sin estrenar eso es el mismo tropiezo, así que se
      // reintenta igual que una lectura. Clonar dos veces no duplica nada: el
      // primer intento no llegó a escribir.
      const build = () =>
        run(
          client.data.rpc("clone_project_version", {
            p_version_id: versionId,
            p_label: label,
          }),
          "project_versions",
          versionId,
        );

      const data = await retryColdRead(build, (row) => row == null);
      return (data as Row | null) ?? null;
    },
  };
}
