import { describe, expect, it } from "vitest";

import {
  NODE_TEXT_DEBOUNCE_MS,
  planNodeBlur,
  planNodeSave,
} from "@/components/tree/autosave";

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

describe("Un Nodo vacío al desenfocarlo", () => {
  it("desaparece si no tiene hijos", () => {
    expect(planNodeBlur("", false)).toEqual({ kind: "discard" });
  });

  it("se conserva si tiene hijos, por vacío que esté", () => {
    // La mitad importante de la regla: borrar un Nodo arrastra su subárbol, así
    // que vaciar un título no puede destruir lo que cuelga de él — y menos sin
    // el diálogo de confirmación que cualquier otro borrado exige.
    expect(planNodeBlur("", true)).toEqual({ kind: "keep" });
  });

  it("se conserva si tiene texto", () => {
    expect(planNodeBlur("Pagos", false)).toEqual({ kind: "keep" });
  });

  it("solo espacios cuenta como vacío", () => {
    // Al revés que `planNodeSave`, que guarda en crudo. Aquélla contesta «¿esto
    // es un cambio?»; ésta, «¿hay una idea aquí?».
    expect(planNodeBlur("   \n  ", false)).toEqual({ kind: "discard" });
  });

  it("un Nodo con texto y con hijos se conserva, que es el caso de siempre", () => {
    expect(planNodeBlur("Pagos", true)).toEqual({ kind: "keep" });
  });
});
