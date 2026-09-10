/**
 * El tropiezo de la sesión en una LECTURA (#41).
 *
 * Reproduce lo que se veía en el navegador: la primera petición al Data API
 * vuelve **200 con cero filas** —RLS no casó porque `auth.uid()` salía nulo en
 * esa conexión del pool— y la siguiente, con el mismo token, trae la lista
 * entera. Se veía como «los Proyectos salen vacíos la primera vez y al recargar
 * ya están».
 *
 * Con el bug presente estos tests fallan: el store devolvía la lista vacía tal
 * cual, porque una lectura sin error no tenía nada que atrapar.
 *
 * El doble imita solo lo que el store usa del SDK —`from().select()` con sus
 * `eq`/`order`, y la forma `{ data, error }` al esperarlo—, y no el SDK entero:
 * lo que se prueba es la decisión del store, no PostgREST.
 */

import { describe, expect, it } from "vitest";

import { createNeonRowStore } from "@/lib/backend/adapters/neon/store";
import type { NeonBrowserClient } from "@/lib/backend/adapters/neon/client";
import type { Row } from "@/lib/backend/adapters/postgrest/store";

/** Una respuesta de PostgREST, ya sin error. */
type Answer = { rows: Row[]; count?: number };

/**
 * El constructor de consultas, reducido a lo que el store encadena.
 *
 * Es `thenable` y no una promesa: el SDK devuelve un builder que solo sale a la
 * red al esperarlo, y de ahí viene la regla que obligó a que `retryEmptyOnce`
 * reciba una FUNCIÓN — un builder ya esperado no se puede volver a usar.
 */
function builder(answer: () => Answer) {
  const self = {
    select: () => self,
    eq: () => self,
    order: () => self,
    limit: () => self,
    ilike: () => self,
    then: (resolve: (value: unknown) => unknown) => {
      const { rows, count } = answer();
      return Promise.resolve({ data: rows, error: null, count }).then(resolve);
    },
  };
  return self;
}

/**
 * Un cliente que contesta lo que diga `answers`, una respuesta por petición.
 *
 * @returns el cliente y cuántas peticiones se le hicieron, que es la mitad de
 *   lo que hay que afirmar: reintentar de más también es un fallo.
 */
function fakeClient(answers: Answer[]) {
  let calls = 0;
  let warm = false;

  const client = {
    data: {
      from: () =>
        builder(() => {
          const answer = answers[Math.min(calls, answers.length - 1)];
          calls += 1;
          return answer;
        }),
    },
    tokenIsFresh: () => !warm,
    markTokenWarm: () => {
      warm = true;
    },
    forgetToken: () => {
      warm = false;
    },
  } as unknown as NeonBrowserClient;

  return { client, calls: () => calls };
}

const UNA_FILA: Answer = { rows: [{ id: "p1" }], count: 1 };
const VACIA: Answer = { rows: [], count: 0 };

describe("una lectura vacía con el token recién estrenado", () => {
  it("se vuelve a preguntar, y la segunda respuesta es la que vale", async () => {
    // Es el bug tal cual: `project_overviews` contesta 200 con `[]` y a la
    // siguiente trae los Proyectos.
    const { client, calls } = fakeClient([VACIA, UNA_FILA]);

    const rows = await createNeonRowStore(client).select("project_overviews");

    expect(rows).toEqual([{ id: "p1" }]);
    expect(calls()).toBe(2);
  });

  it("y una sola vez: si la segunda también vino vacía, está vacía", async () => {
    // Una cuenta recién creada paga un viaje de más la primera vez y ninguno
    // después. Un bucle aquí dejaría la pantalla girando para siempre.
    const { client, calls } = fakeClient([VACIA, VACIA, UNA_FILA]);

    expect(await createNeonRowStore(client).select("projects")).toEqual([]);
    expect(calls()).toBe(2);
  });

  it("con filas no se reintenta: RLS casó", async () => {
    const { client, calls } = fakeClient([UNA_FILA]);

    expect(await createNeonRowStore(client).select("projects")).toEqual([
      { id: "p1" },
    ]);
    expect(calls()).toBe(1);
  });

  it("la ventana se cierra al gastar el reintento, no antes", async () => {
    // Con el token ya rodado, una lista vacía es una lista vacía: la Versión
    // sin Nodos y la Búsqueda sin resultados no pueden pagar un viaje de más
    // cada vez que se miran.
    const { client, calls } = fakeClient([VACIA, VACIA, VACIA]);
    const store = createNeonRowStore(client);

    await store.select("projects"); // dos peticiones: la primera y su reintento
    await store.select("projects"); // una sola: el token ya no está fresco

    expect(calls()).toBe(3);
  });

  it("las tres lecturas del arranque se reintentan, no solo la primera", async () => {
    // Es el caso que se escapó al primer arreglo y por el que el bug siguió
    // apareciendo, ahora en `project_versions`: abrir un Proyecto lanza los
    // Proyectos, las Versiones y el árbol A LA VEZ, y las tres salen dentro de
    // la misma ventana. Mirando la frescura al VOLVER, la primera en contestar
    // la cerraba y dejaba a las otras dos sin reintento.
    const { client, calls } = fakeClient([VACIA, VACIA, VACIA, UNA_FILA]);
    const store = createNeonRowStore(client);

    const [a, b, c] = await Promise.all([
      store.select("projects"),
      store.select("project_versions"),
      store.select("nodes"),
    ]);

    // Seis peticiones: las tres que salieron y sus tres reintentos.
    expect(calls()).toBe(6);
    // Y la que llegó cuando la sesión ya estaba puesta trae sus filas.
    expect([a, b, c].some((rows) => rows.length > 0)).toBe(true);
  });

  it("una respuesta vacía no cierra la ventana: no prueba nada", async () => {
    // Solo una respuesta CON contenido demuestra que la sesión está puesta en
    // la conexión. Cerrar con una vacía es lo que dejaba pasar el tropiezo a la
    // lectura siguiente.
    const { client, calls } = fakeClient([VACIA, VACIA, UNA_FILA]);
    const store = createNeonRowStore(client);

    await store.select("projects"); // vacía + reintento vacío → 2
    expect(calls()).toBe(2);
  });

  it("contar también, porque una cuenta a cero se lee igual de mal", async () => {
    // De esta cifra cuelga la frase del diálogo de borrado: «se lleva 0 Nodos
    // por delante» sobre un árbol de ciento veintiséis es peor que no decirlo.
    const { client, calls } = fakeClient([VACIA, { rows: [], count: 126 }]);

    const total = await createNeonRowStore(client).count("nodes", [
      { column: "version_id", value: "v1" },
    ]);

    expect(total).toBe(126);
    expect(calls()).toBe(2);
  });
});
