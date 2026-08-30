/**
 * La política del Autoguardado de la etiqueta, por contrato.
 *
 * Mismo criterio que `components/tree/autosave.test.ts`: se comprueba lo que
 * la función DECIDE —¿se escribe?, ¿qué se manda?—, nunca cómo lo decide.
 */

import { describe, expect, it } from "vitest";

import { planLabelSave } from "@/components/versions/autosave";

describe("Autoguardado de la etiqueta de una Versión", () => {
  it("una etiqueta nueva se escribe", () => {
    expect(planLabelSave("Con pagos", null)).toEqual({
      kind: "save",
      label: "Con pagos",
    });
  });

  it("cambiarla se escribe", () => {
    expect(planLabelSave("Rumbo C", "Rumbo B")).toEqual({
      kind: "save",
      label: "Rumbo C",
    });
  });

  it("lo mismo que ya está guardado no se vuelve a escribir", () => {
    expect(planLabelSave("Rumbo B", "Rumbo B")).toEqual({ kind: "idle" });
  });

  /**
   * El caso que obliga a comparar recortado: el servicio recorta antes de
   * escribir, así que mandar esto sería una escritura que no cambia la fila.
   */
  it("solo añadir espacios alrededor no es un cambio", () => {
    expect(planLabelSave("  Rumbo B  ", "Rumbo B")).toEqual({ kind: "idle" });
  });

  /**
   * El caso que obliga a que lo guardado pueda ser nulo: una Versión sin
   * etiqueta abre el campo vacío, y abrirlo no puede escribir nada.
   */
  it("un campo vacío sobre una Versión sin etiqueta no es un cambio", () => {
    expect(planLabelSave("", null)).toEqual({ kind: "idle" });
  });

  it("ni aunque lo que haya sean espacios", () => {
    expect(planLabelSave("   ", null)).toEqual({ kind: "idle" });
  });

  /** Vaciar el campo SÍ es un cambio: es cómo se le quita la etiqueta. */
  it("vaciar una etiqueta que existía se escribe", () => {
    expect(planLabelSave("", "Rumbo B")).toEqual({ kind: "save", label: "" });
  });

  /**
   * Se compara recortado, pero se MANDA en crudo: normalizar aquí sería tener
   * la regla en dos sitios, y la del servicio es la que manda.
   */
  it("lo que se manda es lo que se tecleó, sin tocar", () => {
    expect(planLabelSave("  Rumbo C  ", "Rumbo B")).toEqual({
      kind: "save",
      label: "  Rumbo C  ",
    });
  });
});
