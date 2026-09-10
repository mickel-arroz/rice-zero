/**
 * El store de Neon por dentro. Dos bloques, y comparten el mismo doble.
 *
 * ── 1. El tropiezo de la sesión en una LECTURA (#41) ──────────────────────
 *
 * Reproduce lo que se veía en el navegador: la primera petición al Data API
 * vuelve **200 con cero filas** —RLS no casó porque `auth.uid()` salía nulo en
 * esa conexión del pool— y la siguiente, con el mismo token, trae la lista
 * entera. Se veía como «los Proyectos salen vacíos la primera vez y al recargar
 * ya están».
 *
 * La decisión de reintentar vive en `postgrest/warmup.ts` y tiene su test allí.
 * Lo que se comprueba AQUÍ es el cableado: que las cuatro lecturas del store
 * pasen por él, cada una con la señal que de verdad le llega —vacío en tres,
 * un error en la RPC de clonar—.
 *
 * ── 2. La cuenta viaja sin filas (#49) ────────────────────────────────────
 *
 * Que `count` salga como un `HEAD`. No es del mismo Ticket, pero sí del mismo
 * doble: la propiedad no se ve en lo que `count()` devuelve —el número es el
 * mismo se traiga el árbol entero o no se traiga nada—, así que hay que mirar
 * cómo se construyó la consulta, y quien las registra es este doble.
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
import type { NeonDataClient } from "@/lib/backend/adapters/neon/data";
import type { PostgrestFailure } from "@/lib/backend/adapters/postgrest/errors";
import type { Row } from "@/lib/backend/adapters/postgrest/store";

/**
 * Una respuesta de PostgREST: las filas, o el fallo que devolvió el motor.
 *
 * `error` existe porque no todas las lecturas frías se ven igual. Tres vuelven
 * vacías; la RPC de clonar NO puede volver vacía —ver el test de clonar— y solo
 * se manifiesta como un fallo del motor.
 */
type Answer = { rows: Row[]; count?: number; error?: PostgrestFailure };

/**
 * Las opciones con las que se pidió un `select`.
 *
 * Se recogen porque hay una propiedad que NO se ve en la respuesta: que la
 * cuenta salga como un `HEAD` y no se traiga ni una fila (#49). Desde fuera,
 * `count()` devuelve el mismo número de las dos maneras.
 *
 * La proyección no se recoge: con `head: true` no vuelve ninguna columna, así
 * que lo que diga ahí no cambia lo que viaja.
 */
type SelectOptions = { count?: string; head?: boolean } | undefined;

/**
 * El constructor de consultas, reducido a lo que el store encadena.
 *
 * Es `thenable` y no una promesa: el SDK devuelve un builder que solo sale a la
 * red al esperarlo, y de ahí viene la regla que obliga a que `retryColdRead`
 * reciba una FUNCIÓN — un builder ya esperado no se puede volver a usar.
 *
 * @param unaFila si la respuesta trae UNA fila en vez de una lista, que es lo
 *   que devuelve una función que declara `returns public.project_versions`. Va
 *   en un objeto y no suelto para que el sitio que lo pasa se lea.
 */
function builder(
  answer: () => Answer,
  onSelect: (options: SelectOptions) => void,
  { unaFila = false }: { unaFila?: boolean } = {},
) {
  const self = {
    select: (columns?: string, options?: SelectOptions) => {
      onSelect(options);
      return self;
    },
    eq: () => self,
    order: () => self,
    limit: () => self,
    ilike: () => self,
    then: (resolve: (value: unknown) => unknown) => {
      const { rows, count, error } = answer();
      const data = unaFila ? (rows[0] ?? null) : rows;
      return Promise.resolve({ data, error: error ?? null, count }).then(
        resolve,
      );
    },
  };
  return self;
}

/**
 * Un cliente que contesta lo que diga `answers`, una respuesta por petición.
 *
 * `rpc` contesta por el mismo contador que `from`: clonar una Versión también
 * es una lectura para este propósito —la RPC evalúa RLS— y comparte el
 * reintento, así que tiene que compartir también la cuenta de peticiones.
 *
 * @returns el cliente, cuántas peticiones se le hicieron —reintentar de más
 *   también es un fallo— y cómo se pidió cada `select`.
 */
function fakeClient(answers: Answer[]) {
  let calls = 0;
  const selects: SelectOptions[] = [];

  const next = () => {
    const answer = answers[Math.min(calls, answers.length - 1)];
    calls += 1;
    return answer;
  };
  const record = (options: SelectOptions) => {
    selects.push(options);
  };

  const client = {
    data: {
      from: () => builder(next, record),
      rpc: () => builder(next, record, { unaFila: true }),
    },
    forgetToken: () => {},
  } as unknown as NeonDataClient;

  return { client, calls: () => calls, selects: () => selects };
}

const UNA_FILA: Answer = { rows: [{ id: "p1" }], count: 1 };
const VACIA: Answer = { rows: [], count: 0 };
/** Lo que contesta el motor cuando RLS le esconde la Versión de origen. */
const VERSION_OCULTA: Answer = {
  rows: [],
  error: { code: "P0002", message: "La Versión no existe o no es tuya." },
};

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

  it("y clonar, que no vuelve vacía: se queja", async () => {
    // La cuarta lectura, y la única que NO se manifiesta como una lista vacía.
    // `clone_project_version` es `security invoker`, así que sin `auth.uid()`
    // no encuentra la Versión de origen — pero ahí no devuelve `null`, sino que
    // LANZA:
    //
    //     if not found then
    //       raise exception '…' using errcode = 'no_data_found';
    //
    // Ese `P0002` es uno de los `NOT_FOUND_CODES` de `errors.ts`, así que llega
    // al store como `NotFoundError` sobre una Versión que sí estaba. Por eso el
    // reintento entra por la rama de FALLO y no por la de vacío: la regla de
    // `warmup.ts` cubre las dos con la misma frase —«falló o volvió vacía»— y
    // ésta es la que prueba la primera mitad.
    //
    // Repetirla es seguro justamente porque el primer intento NO llegó a
    // escribir: si no vio la Versión de origen, se quedó en el `raise`.
    const { client, calls } = fakeClient([VERSION_OCULTA, UNA_FILA]);

    const fila = await createNeonRowStore(client).cloneVersion("v1", "copia");

    expect(fila).toEqual({ id: "p1" });
    expect(calls()).toBe(2);
  });
});

/**
 * La cuenta viaja sin filas (#49).
 *
 * La cifra de los diálogos de clonar y borrar salía de
 * `listByVersion(...).length` —ciento veintiséis Nodos CON su contenido por el
 * cable para escribir un número en una frase— y hoy sale de un `HEAD`.
 *
 * Que el número sea correcto ya lo afirma el contrato compartido, y que una
 * cuenta a cero se reintente lo afirma el bloque de arriba. Lo que queda sin
 * cubrir es lo que separa las dos implementaciones, y desde fuera no se ve: las
 * dos devuelven 126. Así que aquí se mira cómo se CONSTRUYÓ la consulta —
 * acoplado a la forma del SDK a sabiendas, porque es el único sitio donde la
 * propiedad es observable sin levantar un servidor.
 */
describe("contar no se trae ni una fila", () => {
  it("la consulta sale como HEAD y la cuenta viene en una cabecera", async () => {
    // 126 y no cero: con cero habría reintento y dos `select` registrados, y
    // entonces habría que elegir cuál mirar.
    const { client, selects } = fakeClient([{ rows: [], count: 126 }]);

    await createNeonRowStore(client).count("nodes", [
      { column: "version_id", value: "v1" },
    ]);

    expect(selects()).toHaveLength(1);

    // Las DOS opciones, y ninguna es de estilo:
    //
    // `head: true` es la propiedad de #49 — el motor contesta sin cuerpo, así
    // que no viaja ni una fila. Es lo único que separa esto de volver a
    // traerse el árbol entero para hacerle `.length`.
    //
    // `count: "exact"` es lo que hace que la cifra llegue. Sin él PostgREST no
    // manda `Content-Range`, y entonces `runCount` aplica su `?? 0` y devuelve
    // CERO sin fallar: «se lleva 0 Nodos por delante» sobre un árbol de ciento
    // veintiséis, justo en el diálogo que no se deshace. Un `head` sin `count`
    // es peor que no haber optimizado nada.
    expect(selects()[0]).toEqual({ count: "exact", head: true });
  });
});
