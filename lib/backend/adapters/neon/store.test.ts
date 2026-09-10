/**
 * El tropiezo de la sesión en una LECTURA (#41), visto desde el store de Neon.
 *
 * Reproduce lo que se veía en el navegador: la primera petición al Data API
 * vuelve **200 con cero filas** —RLS no casó porque `auth.uid()` salía nulo en
 * esa conexión del pool— y la siguiente, con el mismo token, trae la lista
 * entera. Se veía como «los Proyectos salen vacíos la primera vez y al recargar
 * ya están».
 *
 * La decisión de reintentar vive en `postgrest/warmup.ts` y tiene su test allí.
 * Lo que se comprueba AQUÍ es el cableado: que las cuatro lecturas del store
 * pasen por él, cada una con su idea de «vacío».
 *
 * ── Por qué este archivo pasaba mientras el bug seguía vivo ───────────────
 *
 * Los dos arreglos anteriores dependían de una señal del cliente
 * —`tokenIsFresh()`, «con este JWT todavía no ha vuelto ninguna petición»— y el
 * doble de aquí la implementaba arrancando en `true`. Eso daba por hecho que
 * cuando el store pregunta YA HAY un token, y el cliente de verdad no lo tiene:
 * lo pide perezosamente, dentro de la petición. En la primerísima lectura la
 * señal contestaba «no está fresco» porque no había nada, y el reintento no
 * salía nunca — justo en el único caso que importaba.
 *
 * El doble mentía sobre el estado inicial del sistema, y por eso los tests eran
 * verdes sobre un bug que el usuario seguía viendo. La lección se paga aquí:
 * este doble ya no sabe nada de tokens, porque el store tampoco.
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
 * red al esperarlo, y de ahí viene la regla que obliga a que `retryColdRead`
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

  const client = {
    data: {
      from: () =>
        builder(() => {
          const answer = answers[Math.min(calls, answers.length - 1)];
          calls += 1;
          return answer;
        }),
    },
    forgetToken: () => {},
  } as unknown as NeonBrowserClient;

  return { client, calls: () => calls };
}

const UNA_FILA: Answer = { rows: [{ id: "p1" }], count: 1 };
const VACIA: Answer = { rows: [], count: 0 };

describe("una lectura vacía se vuelve a pedir", () => {
  it("y la segunda respuesta es la que vale", async () => {
    // Es el bug tal cual: `project_overviews` contesta 200 con `[]` y a la
    // siguiente trae los Proyectos.
    //
    // Y es además el arranque EN FRÍO —este cliente no ha traído ningún token
    // todavía—, que es el caso que los dos arreglos anteriores dejaban fuera:
    // era el único en el que la señal de frescura contestaba «no», por no haber
    // nada de lo que preguntar.
    const { client, calls } = fakeClient([VACIA, UNA_FILA]);

    const rows = await createNeonRowStore(client).select("project_overviews");

    expect(rows).toEqual([{ id: "p1" }]);
    expect(calls()).toBe(2);
  });

  it("una sola vez: si la segunda también vino vacía, está vacía", async () => {
    // Una cuenta que de verdad no tiene nada paga un viaje de más y se le
    // enseña el estado vacío. Un tercer intento sería una pantalla girando.
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

  it("las tres lecturas del arranque se reintentan, no solo la primera", async () => {
    // Abrir un Proyecto lanza los Proyectos, las Versiones y el árbol A LA VEZ.
    // Con una ventana compartida entre lecturas, la primera en contestar se la
    // cerraba a las otras dos; sin ventana no hay nada que cerrar.
    const uno = fakeClient([VACIA, UNA_FILA]);
    const dos = fakeClient([VACIA, UNA_FILA]);
    const tres = fakeClient([VACIA, UNA_FILA]);

    const filas = await Promise.all([
      createNeonRowStore(uno.client).select("projects"),
      createNeonRowStore(dos.client).select("project_versions"),
      createNeonRowStore(tres.client).select("nodes"),
    ]);

    expect(filas.every((rows) => rows.length === 1)).toBe(true);
    expect([uno.calls(), dos.calls(), tres.calls()]).toEqual([2, 2, 2]);
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

  it("y la Búsqueda: «no encontré nada» y «no vi nada» se leen igual", async () => {
    const { client, calls } = fakeClient([VACIA, UNA_FILA]);

    expect(await createNeonRowStore(client).searchNodes("idea", 20)).toEqual([
      { id: "p1" },
    ]);
    expect(calls()).toBe(2);
  });
});
