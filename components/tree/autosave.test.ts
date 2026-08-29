import { describe, expect, it } from "vitest";

import { NODE_TEXT_DEBOUNCE_MS, planNodeSave } from "@/components/tree/autosave";

describe("Autoguardado del texto de un Nodo", () => {
  it("no escribe si el texto no ha cambiado", () => {
    expect(planNodeSave("Autenticación", "Autenticación")).toEqual({ kind: "idle" });
  });

  it("escribe lo tecleado cuando cambia", () => {
    expect(planNodeSave("Autenticación", "Auth")).toEqual({
      kind: "save",
      content: "Autenticación",
    });
  });

  it("un espacio de más ES un cambio: no se recorta nada", () => {
    // Al revés que el título de un Proyecto. Aquí el usuario está escribiendo
    // una frase, y el espacio que acaba de teclear entre dos palabras es
    // exactamente lo que separa «pago movil» de «pago móvil por venta».
    expect(planNodeSave("Pagos ", "Pagos")).toEqual({
      kind: "save",
      content: "Pagos ",
    });
  });

  it("un salto de línea también: el texto de un Nodo puede ser de varias", () => {
    expect(planNodeSave("Pagos\n", "Pagos")).toEqual({
      kind: "save",
      content: "Pagos\n",
    });
  });

  it("vaciar un Nodo es un cambio, no un error", () => {
    // Un Nodo sin texto es legal —nace así— y borrarlo del todo tiene que
    // poder guardarse; si no, «vacío» y «sin tocar» serían lo mismo y no
    // habría forma de deshacer lo escrito sin borrar el Nodo entero.
    expect(planNodeSave("", "Pagos")).toEqual({ kind: "save", content: "" });
  });

  it("un Nodo recién creado que sigue vacío no escribe nada", () => {
    expect(planNodeSave("", "")).toEqual({ kind: "idle" });
  });

  it("el rebote es corto: se teclea contra el motor, no contra un formulario", () => {
    expect(NODE_TEXT_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
    expect(NODE_TEXT_DEBOUNCE_MS).toBeLessThanOrEqual(800);
  });
});
