/**
 * El reintento de una lectura fría (#41).
 *
 * Dos bloques: la regla, que es una tabla de verdad de dos entradas, y el
 * auxiliar, donde vive lo que de verdad se puede romper — cuántos viajes salen,
 * cuál de las dos respuestas se devuelve, y que no haya un tercero.
 */

import { describe, expect, it, vi } from "vitest";

import {
  retryColdRead,
  shouldRetryRead,
} from "@/lib/backend/adapters/postgrest/warmup";
import { NotFoundError, UnauthenticatedError } from "@/lib/backend/ports";

describe("¿se vuelve a preguntar?", () => {
  it("sí, si volvió vacía: es indistinguible del tropiezo de la sesión", () => {
    expect(shouldRetryRead({ failed: false, empty: true })).toBe(true);
  });

  it("sí, si falló", () => {
    expect(shouldRetryRead({ failed: true, empty: false })).toBe(true);
  });

  it("no, si trajo datos: eso ya es la respuesta", () => {
    expect(shouldRetryRead({ failed: false, empty: false })).toBe(false);
  });
});

/** Una lectura que contesta lo que diga la lista, una respuesta por llamada. */
function lector<T>(respuestas: (T | Error)[]) {
  let llamadas = 0;
  const read = vi.fn(async () => {
    const respuesta = respuestas[Math.min(llamadas, respuestas.length - 1)];
    llamadas += 1;
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  });
  return { read, viajes: () => llamadas };
}

/** «Vacío» para una lista de filas, que es el caso del bug. */
const sinFilas = (filas: unknown[]) => filas.length === 0;

describe("una lectura fría se repite una vez", () => {
  it("la lista vacía se vuelve a pedir, y la segunda es la que vale", async () => {
    // El bug tal cual: `project_overviews` contesta 200 con `[]` y a la
    // siguiente trae los tres Proyectos.
    const { read, viajes } = lector([[], [{ id: "p1" }]]);

    expect(await retryColdRead(read, sinFilas)).toEqual([{ id: "p1" }]);
    expect(viajes()).toBe(2);
  });

  it("un error también se vuelve a intentar", async () => {
    const { read, viajes } = lector([new Error("fallo de red"), [{ id: "p1" }]]);

    expect(await retryColdRead(read, sinFilas)).toEqual([{ id: "p1" }]);
    expect(viajes()).toBe(2);
  });

  it("con datos a la primera no hay segundo viaje", async () => {
    const { read, viajes } = lector([[{ id: "p1" }]]);

    await retryColdRead(read, sinFilas);

    expect(viajes()).toBe(1);
  });

  it("la segunda respuesta es la definitiva, aunque vuelva vacía", async () => {
    // Una cuenta recién creada de verdad no tiene Proyectos: paga el viaje de
    // más y se le enseña el estado vacío. Un tercer intento aquí sería una
    // pantalla girando para siempre.
    const { read, viajes } = lector([[], [], [{ id: "p1" }]]);

    expect(await retryColdRead(read, sinFilas)).toEqual([]);
    expect(viajes()).toBe(2);
  });

  it("y aunque vuelva a fallar: se propaga el error del SEGUNDO", async () => {
    const primero = new Error("primero");
    const segundo = new NotFoundError("el Proyecto", "p1");
    const { read, viajes } = lector([primero, segundo, [{ id: "p1" }]]);

    await expect(retryColdRead(read, sinFilas)).rejects.toBe(segundo);
    expect(viajes()).toBe(2);
  });

  it("cada lectura decide por su cuenta: no queda estado entre ellas", async () => {
    // Es lo que se escapó en los dos arreglos anteriores. Abrir un Proyecto
    // lanza tres lecturas A LA VEZ, y con una ventana compartida la primera en
    // contestar se la cerraba a las otras dos. Sin ventana no hay nada que
    // cerrar: las tres se reintentan.
    const uno = lector<unknown[]>([[], [{ id: "a" }]]);
    const dos = lector<unknown[]>([[], [{ id: "b" }]]);
    const tres = lector<unknown[]>([[], [{ id: "c" }]]);

    const resultado = await Promise.all([
      retryColdRead(uno.read, sinFilas),
      retryColdRead(dos.read, sinFilas),
      retryColdRead(tres.read, sinFilas),
    ]);

    expect(resultado).toEqual([[{ id: "a" }], [{ id: "b" }], [{ id: "c" }]]);
    expect([uno.viajes(), dos.viajes(), tres.viajes()]).toEqual([2, 2, 2]);
  });

  it("sin sesión NO se reintenta: no es una lectura que salió mal", async () => {
    // El SDK lanza antes de tocar la red, así que el segundo intento mandaría
    // la misma nada y retrasaría el viaje al login.
    const sinSesion = new UnauthenticatedError("no hay sesión");
    const { read, viajes } = lector([sinSesion, [{ id: "p1" }]]);

    await expect(retryColdRead(read, sinFilas)).rejects.toBe(sinSesion);
    expect(viajes()).toBe(1);
  });

  it("«vacío» lo decide quien llama: una cuenta a cero también cuenta", async () => {
    // De esta cifra cuelga la frase del diálogo de borrado: «se lleva 0 Nodos
    // por delante» sobre un árbol de ciento veintiséis es peor que no decirlo.
    const { read, viajes } = lector([0, 126]);

    expect(await retryColdRead(read, (total) => total === 0)).toBe(126);
    expect(viajes()).toBe(2);
  });

  it("y una RPC sin fila", async () => {
    const { read, viajes } = lector<{ id: string } | null>([null, { id: "v2" }]);

    expect(await retryColdRead(read, (fila) => fila == null)).toEqual({
      id: "v2",
    });
    expect(viajes()).toBe(2);
  });
});
