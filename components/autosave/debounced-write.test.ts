/**
 * El cableado del rebote del Autoguardado, por contrato.
 *
 * Se prueba el NÚCLEO —`createDebouncedWrite`, sin React— y no el hook, y esa
 * es la razón de que el núcleo exista: montar un provider haría falta un
 * renderer que este proyecto no tiene, y lo que hay que comprobar aquí no es
 * React sino el orden de las cosas. Con temporizadores falsos se puede mirar
 * el instante exacto en el que una escritura sale, que es donde están todas
 * las decisiones de este módulo.
 *
 * Mismo criterio que `components/connection/pending.test.ts`: se comprueba lo
 * que el módulo HACE —¿escribe?, ¿cuándo?, ¿qué contesta?—, nunca cómo.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDebouncedWrite } from "@/components/autosave/debounced-write";

/** El mismo medio segundo que usan el texto de un Nodo y la etiqueta. */
const DELAY = 500;

/**
 * Un rebote con la escritura bajo control.
 *
 * `calls` deja ver el ORDEN en el que salieron las escrituras, que es lo que
 * distingue «se agrupó la ráfaga» de «se mandó una por tecla». `answer` deja
 * decidir a cada prueba si la escritura funciona, falla o se queda colgada.
 */
function harness() {
  const calls: string[] = [];
  let answer: (id: string) => Promise<boolean> = async () => true;

  const onHold = vi.fn();
  const onRelease = vi.fn();
  const debounced = createDebouncedWrite({
    delayMs: DELAY,
    write: (id) => {
      calls.push(id);
      return answer(id);
    },
    onHold,
    onRelease,
  });

  return {
    calls,
    onHold,
    onRelease,
    debounced,
    answerWith(next: (id: string) => Promise<boolean>) {
      answer = next;
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("El rebote del Autoguardado", () => {
  it("agrupa una ráfaga de teclas en una sola escritura", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    h.debounced.schedule("n1");
    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(h.calls).toEqual(["n1"]);
  });

  it("no escribe nada antes de que pase el rebote", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY - 1);
    expect(h.calls).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(h.calls).toEqual(["n1"]);
  });

  /**
   * Lo que hace falta para que esto pueda vivir en un componente: el hueco
   * pendiente sobrevive a los repintados, pero lo que escribe se rehace en
   * cada uno. Sin refrescarlo, el rebote de medio segundo escribiría con el
   * árbol de antes de la última relectura.
   */
  it("escribe con el cierre de AHORA y no con el de entonces", async () => {
    const h = harness();
    const rewired: string[] = [];

    h.debounced.schedule("n1");
    h.debounced.setHandlers({
      write: async (id) => {
        rewired.push(id);
        return true;
      },
      onHold: h.onHold,
      onRelease: h.onRelease,
    });
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(h.calls).toEqual([]);
    expect(rewired).toEqual(["n1"]);
  });

  /**
   * El caso que obliga a vaciar y no a cancelar: sin esto, escribir en A y
   * saltar a B perdería lo tecleado en A.
   */
  it("cambiar de id vacía el anterior en el acto", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    h.debounced.schedule("n2");
    // Sin tocar el reloj: lo de A ya salió.
    expect(h.calls).toEqual(["n1"]);

    await vi.advanceTimersByTimeAsync(DELAY);
    expect(h.calls).toEqual(["n1", "n2"]);
  });
});

describe("Vaciar lo pendiente antes de otra escritura", () => {
  it("adelanta el rebote que aún no ha disparado", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    expect(await h.debounced.flushPending(false)).toBe(true);
    expect(h.calls).toEqual(["n1"]);

    // Y no lo vuelve a escribir cuando el temporizador habría saltado.
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(h.calls).toEqual(["n1"]);
  });

  /**
   * La segunda espera, la que no es obvia: el temporizador pudo lanzar la
   * escritura hace un instante y su respuesta aterrizaría DESPUÉS de la
   * relectura, pisando lo recién leído con la fila de antes.
   */
  it("espera a la escritura que ya salió y todavía no ha vuelto", async () => {
    const h = harness();
    let land!: (ok: boolean) => void;
    h.answerWith(() => new Promise<boolean>((resolve) => (land = resolve)));

    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(h.calls).toEqual(["n1"]);

    let done = false;
    const flushed = h.debounced.flushPending(false).then((ok) => {
      done = true;
      return ok;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(false);

    land(true);
    expect(await flushed).toBe(true);
  });

  it("sin nada pendiente dice que está todo a salvo", async () => {
    const h = harness();

    expect(await h.debounced.flushPending(false)).toBe(true);
    expect(h.calls).toEqual([]);
  });

  /** Lo que impide mover un Nodo —o clonar una Versión— sobre algo perdido. */
  it("una escritura que falla se cuenta como que NO quedó a salvo", async () => {
    const h = harness();
    h.answerWith(async () => false);

    h.debounced.schedule("n1");
    expect(await h.debounced.flushPending(false)).toBe(false);
  });

  /**
   * Y arrastra también el fallo de la que ya iba EN VUELO, no solo el de la
   * que se adelanta: son dos escrituras sobre la misma fila, y lo que se
   * pregunta es si quedó todo a salvo.
   */
  it("una escritura en vuelo que falla también cuenta", async () => {
    const h = harness();
    let land!: (ok: boolean) => void;
    h.answerWith(() => new Promise<boolean>((resolve) => (land = resolve)));

    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);

    // Con la primera todavía colgada, se teclea en otro sitio y se pregunta.
    h.answerWith(async () => true);
    h.debounced.schedule("n2");
    const flushed = h.debounced.flushPending(false);
    land(false);

    expect(await flushed).toBe(false);
    expect(h.calls).toEqual(["n1", "n2"]);
  });

  /**
   * El límite, dicho a propósito: solo se responde por las escrituras que
   * todavía se están esperando. Una que ya volvió con fallo dejó de estar en
   * vuelo, y quien lo cuenta a partir de ahí es el pie con su «No se guardó».
   * Recordarla aquí para siempre bloquearía la pantalla incluso después de
   * que el usuario reescribiera y aquello se guardara bien.
   */
  it("una escritura que ya volvió no se recuerda", async () => {
    const h = harness();
    h.answerWith(async () => false);

    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(await h.debounced.flushPending(false)).toBe(true);
  });
});

describe("El rebote sin red", () => {
  it("retiene lo tecleado en vez de escribirlo contra el vacío", async () => {
    const h = harness();

    h.debounced.setBlocked(true);
    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(h.calls).toEqual([]);
    expect(h.onHold).toHaveBeenCalledTimes(1);
  });

  it("y lo suelta solo al volver la conexión", async () => {
    const h = harness();

    h.debounced.setBlocked(true);
    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);

    h.debounced.setBlocked(false);
    expect(h.onRelease).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.calls).toEqual(["n1"]);
  });

  it("lo ya retenido no se vuelve a retener", async () => {
    const h = harness();

    h.debounced.setBlocked(true);
    h.debounced.schedule("n1");
    await vi.advanceTimersByTimeAsync(DELAY);
    h.debounced.setBlocked(true);

    expect(h.onHold).toHaveBeenCalledTimes(1);
  });

  it("un rebote en marcha no se adelanta porque cambie el banner", () => {
    const h = harness();

    h.debounced.schedule("n1");
    h.debounced.setBlocked(false);

    expect(h.calls).toEqual([]);
  });

  it("vaciar lo pendiente sin red retiene, para el reloj y dice que no", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    expect(await h.debounced.flushPending(true)).toBe(false);
    expect(h.calls).toEqual([]);
    expect(h.onHold).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(DELAY);
    expect(h.calls).toEqual([]);
  });

  /** La misma fila de `movePending` que en `setBlocked`: «held + sin red». */
  it("y preguntar dos veces no vuelve a retener lo ya retenido", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    await h.debounced.flushPending(true);
    expect(await h.debounced.flushPending(true)).toBe(false);

    expect(h.onHold).toHaveBeenCalledTimes(1);
  });
});

describe("Salir de la pantalla", () => {
  it("escribe en el acto lo que el rebote aún guardaba", () => {
    const h = harness();

    h.debounced.schedule("n1");
    h.debounced.leave();

    expect(h.calls).toEqual(["n1"]);
  });

  /**
   * El límite que el spec ya asume al dejar fuera las colas de sincronización:
   * cerrar la pestaña sin red pierde lo escrito, y el pie lo viene diciendo.
   */
  it("sin red no manda nada: lo retenido se queda retenido", () => {
    const h = harness();

    h.debounced.setBlocked(true);
    h.debounced.schedule("n1");
    h.debounced.leave();

    expect(h.calls).toEqual([]);
  });

  it("sin nada pendiente no escribe", () => {
    const h = harness();

    h.debounced.leave();

    expect(h.calls).toEqual([]);
  });
});

describe("Desmontar la pantalla", () => {
  /**
   * El caso que obliga a que `dispose` exista aparte de `leave`: sin red,
   * `schedule` arma el temporizador igual —quien retiene es `setBlocked`, y
   * puede no haber corrido todavía—, y `leave` no lo toca porque no hay red a
   * la que mandar nada. Ese temporizador despertaría medio segundo después
   * para avisar a un provider que ya no está.
   */
  it("apaga el temporizador que sobrevivió a la salida sin red", async () => {
    const h = harness();

    h.debounced.setBlocked(true);
    h.debounced.schedule("n1");
    h.debounced.leave();
    h.debounced.dispose();
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(h.calls).toEqual([]);
    expect(h.onHold).not.toHaveBeenCalled();
  });

  /** Lo que ya salió no se cancela: `dispose` apaga el reloj, no la petición. */
  it("no toca la escritura que leave acaba de mandar", async () => {
    const h = harness();

    h.debounced.schedule("n1");
    h.debounced.leave();
    h.debounced.dispose();
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(h.calls).toEqual(["n1"]);
  });
});
