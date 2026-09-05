import { describe, expect, it } from "vitest";

import {
  BACK_MS,
  blocksMutations,
  nextPhase,
  settlePhase,
} from "@/components/connection/connection";

describe("Fases de la conexión", () => {
  it("perder la red bloquea, se viniera de donde se viniera", () => {
    expect(nextPhase("online", true)).toBe("offline");
    expect(nextPhase("offline", true)).toBe("offline");
    // Caer otra vez durante el «de vuelta» cancela la celebración.
    expect(nextPhase("back", true)).toBe("offline");
  });

  it("recuperarla pasa por «de vuelta», no directo a normal", () => {
    // El aviso tiene que llegar a verse: sin esta parada, reconectar sería
    // que el banner desaparece y nadie sabe por qué la app volvió a responder.
    expect(nextPhase("offline", false)).toBe("back");
  });

  it("estando ya normal, seguir con red no anuncia nada", () => {
    // Es el arranque de toda sesión con red: sin esta rama, cada carga de
    // página enseñaría un «de vuelta» de algo que nunca se fue.
    expect(nextPhase("online", false)).toBe("online");
  });

  it("el «de vuelta» no se renueva solo mientras hay red", () => {
    // Lo apaga el temporizador (`settlePhase`), no el detector. Si esta rama
    // devolviera «back» otra vez cada vez que el hook repinta, el aviso se
    // quedaría fijo en pantalla para siempre.
    expect(nextPhase("back", false)).toBe("back");
  });

  it("el temporizador solo apaga el «de vuelta»", () => {
    expect(settlePhase("back")).toBe("online");
    // Y nunca desbloquea: un temporizador que pudiera sacar de «offline»
    // reactivaría la edición sin que haya vuelto la red.
    expect(settlePhase("offline")).toBe("offline");
    expect(settlePhase("online")).toBe("online");
  });

  it("solo «offline» bloquea las mutaciones", () => {
    expect(blocksMutations("offline")).toBe(true);
    // En «de vuelta» ya se puede escribir: el aviso sigue en pantalla dos
    // segundos, pero la red ya está y hacer esperar a esos dos segundos sería
    // un bloqueo inventado.
    expect(blocksMutations("back")).toBe(false);
    expect(blocksMutations("online")).toBe(false);
  });

  it("el «de vuelta» dura lo justo para leerse y no molesta", () => {
    expect(BACK_MS).toBeGreaterThanOrEqual(1000);
    expect(BACK_MS).toBeLessThanOrEqual(4000);
  });
});
