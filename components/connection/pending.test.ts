import { describe, expect, it } from "vitest";

import {
  movePending,
  pendingState,
  type PendingSlot,
} from "@/components/connection/pending";

/** Un hueco con el temporizador en marcha. El tipo real es un `setTimeout`. */
const armed: PendingSlot<number> = { id: "n1", timer: 1 };
/** Un hueco retenido: sin temporizador, esperando a que vuelva la red. */
const held: PendingSlot<number> = { id: "n1", timer: null };

describe("El borrador que espera a escribirse", () => {
  it("distingue vacío, en rebote y retenido", () => {
    expect(pendingState(null)).toBe("none");
    expect(pendingState(armed)).toBe("armed");
    expect(pendingState(held)).toBe("held");
  });

  it("al perder la red, lo que estaba rebotando se retiene", () => {
    // Es todo el ticket en una línea: en vez de dejar que el temporizador
    // dispare la escritura contra una red que ya no está, el borrador se
    // queda. Sin esto, el pie diría «No se guardó» sobre una idea que sigue
    // viva solo en la pantalla.
    expect(movePending("armed", true)).toBe("hold");
  });

  it("al volver la red, lo retenido sale solo", () => {
    // «La edición se reactiva sola» no vale de nada si lo escrito antes del
    // corte espera a que el usuario se acuerde de tocar el campo otra vez.
    expect(movePending("held", false)).toBe("release");
  });

  it("un rebote normal no se adelanta porque cambie la fase", () => {
    // La trampa: el banner pasa de «de vuelta» a normal mientras alguien
    // teclea, y con un `release` aquí la escritura saldría a mitad de palabra.
    expect(movePending("armed", false)).toBe("keep");
  });

  it("lo ya retenido no se vuelve a retener", () => {
    // Sin esta rama, cada repintado con la red caída reescribiría el hueco y
    // volvería a marcar «Pendiente» sobre un estado que ya lo decía.
    expect(movePending("held", true)).toBe("keep");
  });

  it("sin nada escrito no pasa nada, haya red o no", () => {
    expect(movePending("none", true)).toBe("keep");
    expect(movePending("none", false)).toBe("keep");
  });
});
