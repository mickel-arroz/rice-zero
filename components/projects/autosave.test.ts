/**
 * El contrato del Autoguardado, escrito antes que su implementación.
 *
 * Cada caso es una decisión de producto, no un detalle: qué cuenta como
 * cambio, qué viaja en el parche y qué pasa con un borrador a medio escribir.
 */

import { describe, expect, it } from "vitest";

import { planAutosave, type ProjectDraft } from "@/components/projects/autosave";
import { PROJECT_ERRORS } from "@/lib/services/projects";

const SAVED: ProjectDraft = {
  title: "Tienda online",
  description: "Catálogo y carrito.",
  icon: "bag",
};

describe("planAutosave", () => {
  it("no escribe cuando nada ha cambiado", () => {
    expect(planAutosave({ ...SAVED }, SAVED)).toEqual({ kind: "idle" });
  });

  it("manda solo el campo que cambió", () => {
    expect(planAutosave({ ...SAVED, title: "Tienda" }, SAVED)).toEqual({
      kind: "save",
      patch: { title: "Tienda" },
    });

    expect(planAutosave({ ...SAVED, icon: "rocket" }, SAVED)).toEqual({
      kind: "save",
      patch: { icon: "rocket" },
    });
  });

  it("manda los dos cuando cambian los dos", () => {
    const plan = planAutosave(
      { ...SAVED, title: "Tienda", description: "Otra cosa." },
      SAVED,
    );

    expect(plan).toEqual({
      kind: "save",
      patch: { title: "Tienda", description: "Otra cosa." },
    });
  });

  it("vaciar la descripción es un cambio, y se guarda", () => {
    // Es la diferencia entre «no la toques» y «ponla a nulo»: si vaciarla no
    // contara como cambio, no habría forma de quitar una descripción.
    expect(planAutosave({ ...SAVED, description: "" }, SAVED)).toEqual({
      kind: "save",
      patch: { description: "" },
    });
  });

  it("no escribe un título vacío, y lo dice", () => {
    // Un Proyecto sin título no existe, así que borrar el campo para reescribir
    // no puede persistirse a medias. Tampoco es un error del que haya que
    // recuperarse: es un borrador que aún no vale.
    expect(planAutosave({ ...SAVED, title: "   " }, SAVED)).toEqual({
      kind: "invalid",
      message: PROJECT_ERRORS.titleEmpty,
    });
  });

  it("un título vacío frena TODO el parche, no solo el título", () => {
    // Guardar el icono mientras el título está a medias dejaría la pantalla
    // diciendo «guardado» con la mitad sin guardar.
    expect(
      planAutosave({ title: "", description: "Otra.", icon: "rocket" }, SAVED),
    ).toEqual({ kind: "invalid", message: PROJECT_ERRORS.titleEmpty });
  });

  it("los espacios de alrededor no son un cambio", () => {
    // La capa de servicios recorta antes de escribir, así que «Tienda online »
    // y «Tienda online» acaban siendo la misma fila: mandarlo sería una
    // escritura que no cambia nada.
    expect(planAutosave({ ...SAVED, title: "  Tienda online  " }, SAVED)).toEqual({
      kind: "idle",
    });
  });
});
