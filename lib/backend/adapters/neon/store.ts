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

import type { NeonBrowserClient } from "@/lib/backend/adapters/neon/client";
import {
  asRelation,
  asRows,
  asWritePayload,
  createRunner,
  filteredId,
} from "@/lib/backend/adapters/postgrest/response";
import type { Row, RowStore } from "@/lib/backend/adapters/postgrest/store";
import { UnauthenticatedError } from "@/lib/backend/ports";

/**
 * El SDK de Neon no espera a que el motor conteste: si no hay token que
 * inyectar, lanza antes de salir a la red. Es una sesión que falta, no un fallo
 * de transporte.
 */
const run = createRunner((error) =>
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
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  return (
    cause?.code === "42501" &&
    /row[- ]level security/i.test(cause.message ?? "")
  );
}

export function createNeonRowStore(client: NeonBrowserClient): RowStore {
  /**
   * Una escritura, y un segundo intento si fue el tropiezo de arriba.
   *
   * Reintentar una escritura solo es seguro porque un rechazo de RLS aborta la
   * sentencia: no se escribió nada, así que no hay forma de duplicar un
   * Proyecto. Por eso NO envuelve a `select`: una lectura con `auth.uid()` nulo
   * no falla, devuelve cero filas en silencio, y ahí no hay nada que detectar.
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
      return asRows(await run(query, source, filteredId(options?.where)));
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
      const data = await run(
        client.data.rpc("clone_project_version", {
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
