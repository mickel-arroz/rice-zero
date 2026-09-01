/**
 * El ensamblaje del prompt de Análisis.
 *
 * No se prueba la redacción —eso cambia y no debe romper tests— sino las
 * propiedades que el ADR 0003 pone por escrito: determinismo, precedencia de
 * las Directrices sobre todo lo demás, el árbol delimitado sin ambigüedad y la
 * advertencia de que un árbol no es siempre un proyecto nuevo.
 */

import { describe, expect, it } from "vitest";

import { buildAnalysisPrompt } from "@/lib/ai/prompt";
import { SAMPLE_TREES } from "@/lib/ai/testing/samples";
import { serializeTree } from "@/lib/tree/serialize";

const tree = serializeTree(SAMPLE_TREES.fix);

describe("buildAnalysisPrompt", () => {
  it("es determinista: mismas entradas, texto idéntico", () => {
    const guidelines = "Esto es un fix sobre algo ya desplegado.";
    expect(buildAnalysisPrompt({ serializedTree: tree, guidelines })).toBe(
      buildAnalysisPrompt({ serializedTree: tree, guidelines }),
    );
    expect(buildAnalysisPrompt({ serializedTree: tree })).toBe(
      buildAnalysisPrompt({ serializedTree: tree }),
    );
  });

  it("mete el árbol serializado tal cual, sin re-serializar nada", () => {
    expect(buildAnalysisPrompt({ serializedTree: tree })).toContain(tree);
  });

  it("delimita el árbol: se sabe dónde empieza y dónde acaba", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    const start = prompt.indexOf("<arbol>");
    const end = prompt.indexOf("</arbol>");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(prompt.slice(start, end)).toContain(tree);
  });

  it("sin Directrices no inventa un bloque de Directrices vacío", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    expect(prompt).not.toContain("DIRECTRICES DEL USUARIO");
  });

  it("unas Directrices en blanco cuentan como no haberlas", () => {
    const blank = buildAnalysisPrompt({ serializedTree: tree, guidelines: "   \n  " });
    expect(blank).toBe(buildAnalysisPrompt({ serializedTree: tree }));
  });

  it("las Directrices ganan: su bloque va ANTES que las reglas que contradicen", () => {
    const guidelines = "Esto NO es un proyecto nuevo: es un fix.";
    const prompt = buildAnalysisPrompt({ serializedTree: tree, guidelines });

    const block = prompt.indexOf("DIRECTRICES DEL USUARIO");
    const deduction = prompt.indexOf("Paso 1");
    const checksRule = prompt.indexOf("LA REGLA DE LOS CHECKS");

    expect(block).toBeGreaterThan(-1);
    expect(block).toBeLessThan(deduction);
    expect(block).toBeLessThan(checksRule);
    expect(prompt).toContain(guidelines);
  });

  it("dice con todas las letras que las Directrices mandan sobre este prompt", () => {
    const prompt = buildAnalysisPrompt({
      serializedTree: tree,
      guidelines: "Trátalo como refactor.",
    });
    const block = prompt.slice(prompt.indexOf("DIRECTRICES DEL USUARIO"));
    const precedence = block.slice(0, block.indexOf("<directrices>"));
    expect(precedence.toLowerCase()).toContain("ganan");
    expect(precedence).toContain("Intención");
  });

  it("advierte de que no se suponga proyecto nuevo", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    expect(prompt.toLowerCase()).toContain("no supongas que esto es un proyecto nuevo");
  });

  it("nombra los cuatro pasos, la regla de los Checks y el destino del texto", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    for (const marker of ["Paso 1", "Paso 2", "Paso 3", "Paso 4", "LA REGLA DE LOS CHECKS"]) {
      expect(prompt).toContain(marker);
    }
    expect(prompt).toContain("/implement");
  });

  it("los pasos van en orden", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    const positions = ["Paso 1", "Paso 2", "Paso 3", "Paso 4"].map((s) => prompt.indexOf(s));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("pide todos los `kind` del enum, para que ninguno quede inalcanzable", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    for (const kind of ["proyecto-nuevo", "feature", "fix", "refactor", "ui", "infra", "docs", "otro"]) {
      expect(prompt).toContain(kind);
    }
  });

  it("manda escribir en el idioma del árbol, no en el del prompt", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    expect(prompt.toLowerCase()).toContain("idioma");
  });

  it("exige que todo Nodo quede representado en algún Ticket", () => {
    const prompt = buildAnalysisPrompt({ serializedTree: tree });
    expect(prompt).toContain("Todo Nodo del árbol");
  });
});
