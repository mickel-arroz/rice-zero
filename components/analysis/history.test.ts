import { describe, expect, it } from "vitest";

import {
  analysisWhen,
  currentAnalysis,
  isCurrent,
  shownAnalysis,
} from "@/components/analysis/history";
import { sampleAnalysis } from "@/lib/ai/testing/samples";
import type { Analysis } from "@/lib/backend/ports";

/**
 * Un Análisis guardado. Solo el `id` importa aquí: lo que estas funciones
 * deciden es CUÁL, nunca qué lleva dentro.
 */
function stored(id: string): Analysis {
  return {
    id,
    versionId: "v-1",
    userGuidelines: null,
    provider: "gemini",
    model: "gemini-2.5-flash",
    content: sampleAnalysis(),
    createdAt: new Date(2026, 8, 5, 14, 32),
  };
}

/** Como llega del puerto: del más nuevo al más viejo. */
const LISTA = [stored("nuevo"), stored("medio"), stored("viejo")];

describe("currentAnalysis", () => {
  it("el vigente es el primero, porque la lista viene del más nuevo al más viejo", () => {
    expect(currentAnalysis(LISTA)?.id).toBe("nuevo");
  });

  it("una Versión sin analizar no tiene vigente", () => {
    expect(currentAnalysis([])).toBeNull();
  });
});

describe("isCurrent", () => {
  it("solo el más nuevo lo es", () => {
    expect(isCurrent(LISTA, "nuevo")).toBe(true);
    expect(isCurrent(LISTA, "medio")).toBe(false);
  });

  it("sin lista no hay vigente que valga", () => {
    expect(isCurrent([], "nuevo")).toBe(false);
  });
});

describe("shownAnalysis", () => {
  it("sin nada elegido se enseña el vigente", () => {
    expect(shownAnalysis(LISTA, null)?.id).toBe("nuevo");
  });

  it("con uno elegido se enseña ése", () => {
    expect(shownAnalysis(LISTA, "medio")?.id).toBe("medio");
  });

  /**
   * El caso que justifica que esto sea una función y no `find()` en el render.
   *
   * Borrar el Análisis que estás leyendo deja la elección apuntando a algo que
   * ya no existe. Sin esta caída, el panel se quedaría en blanco justo después
   * de una acción que sí funcionó, y la única salida sería cerrar la hoja. Se
   * vuelve al vigente, que es lo que se estaba enseñando antes de entrar al
   * Historial.
   */
  it("si lo elegido ya no está —lo acabas de borrar— se cae al vigente", () => {
    expect(shownAnalysis(LISTA, "fantasma")?.id).toBe("nuevo");
  });

  it("sin Análisis no se enseña ninguno, se haya elegido o no", () => {
    expect(shownAnalysis([], null)).toBeNull();
    expect(shownAnalysis([], "medio")).toBeNull();
  });
});

describe("analysisWhen", () => {
  it("fecha el Análisis contra el reloj del panel", () => {
    expect(analysisWhen(stored("nuevo"), new Date(2026, 8, 5, 16, 0))).toBe("hoy 14:32");
  });

  /**
   * El reloj se fija al ABRIR la hoja, así que en la práctica siempre está.
   * Lo que esta prueba clava es que la rama muerta CALLA en vez de rellenar el
   * hueco: la primera versión ponía ahí el modelo, y el diálogo de borrar
   * llegaba a preguntar «¿Borrar el Análisis de gemini-2.5-flash?».
   */
  it("sin reloj no se inventa una fecha", () => {
    expect(analysisWhen(stored("nuevo"), null)).toBeNull();
  });
});
