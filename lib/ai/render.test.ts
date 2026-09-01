/**
 * El render del Análisis a texto plano.
 *
 * El test central es el de la lista negra, y se corre sobre un Análisis cuyo
 * CONTENIDO viene lleno de adorno (`adornedAnalysis`). Esa es la diferencia
 * entre probar que el renderer no escribe negritas —trivial, no hay línea que
 * las escriba— y probar que no las DEJA PASAR, que es lo que promete el ADR.
 */

import { describe, expect, it } from "vitest";

import { renderMasterPrompt, renderTicketPrompt } from "@/lib/ai/render";
import { adornedAnalysis, sampleAnalysis } from "@/lib/ai/testing/samples";

/** Lo prohibido, tal cual lo enumera `CONTEXT.md` → Master Prompt. */
const FORBIDDEN: [name: string, pattern: RegExp][] = [
  ["negritas o cursivas con asterisco", /\*/],
  ["cursivas o negritas con guion bajo", /_/],
  ["encabezados con almohadilla", /#/],
  ["tablas", /\|/],
  ["code fences o código en línea", /`/],
  ["tachado", /~/],
  ["emojis", /\p{Extended_Pictographic}/u],
];

function assertPlain(text: string): void {
  for (const [name, pattern] of FORBIDDEN) {
    expect(pattern.test(text), `${name}: ${pattern.exec(text)?.[0]}`).toBe(false);
  }
}

describe("renderMasterPrompt", () => {
  it("no deja pasar adorno, aunque venga en el contenido del modelo", () => {
    assertPlain(renderMasterPrompt(adornedAnalysis()));
  });

  it("sí conserva las marcas permitidas: guiones, numeración y casillas", () => {
    const text = renderMasterPrompt(sampleAnalysis());
    expect(text).toContain("- [ ] ");
    expect(text).toContain("- El filtro vive en la query string");
    expect(text).toContain("1. ¿Las tallas");
  });

  it("dice la Intención y su porqué", () => {
    const analysis = sampleAnalysis();
    const text = renderMasterPrompt(analysis);
    expect(text).toContain("INTENCIÓN: Feature");
    expect(text).toContain(analysis.intent.rationale);
  });

  it("lleva el Spec entero y todos los Tickets con sus Checks", () => {
    const analysis = sampleAnalysis();
    const text = renderMasterPrompt(analysis);

    expect(text).toContain(analysis.spec.problem);
    expect(text).toContain(analysis.spec.solution);
    for (const item of [...analysis.spec.outOfScope, ...analysis.spec.testing]) {
      expect(text).toContain(item);
    }
    for (const check of analysis.spec.checks) {
      expect(text).toContain(`- [ ] ${check}`);
    }
    for (const ticket of analysis.tickets) {
      expect(text).toContain(`TICKET ${ticket.id}: ${ticket.title}`);
      expect(text).toContain(ticket.build);
      for (const check of ticket.checks) expect(text).toContain(`- [ ] ${check}`);
    }
  });

  it("nombra los bloqueos por id y por título: un id suelto no dice nada", () => {
    expect(renderMasterPrompt(sampleAnalysis())).toContain(
      "BLOQUEADO POR: t1 (Listado de productos)",
    );
  });

  it("sin preguntas no pinta un apartado de preguntas vacío", () => {
    const analysis = sampleAnalysis();
    analysis.questions = [];
    expect(renderMasterPrompt(analysis)).not.toContain("PREGUNTAS");
  });

  it("sin fuera de alcance no pinta un apartado vacío", () => {
    const analysis = sampleAnalysis();
    analysis.spec.outOfScope = [];
    expect(renderMasterPrompt(analysis)).not.toContain("FUERA DE ALCANCE");
  });

  it("no deja líneas en blanco de más ni espacios al final", () => {
    const text = renderMasterPrompt(sampleAnalysis());
    expect(text).not.toMatch(/\n{3}/);
    expect(text).not.toMatch(/[ \t]+\n/);
    expect(text).toBe(text.trim());
  });

  it("es determinista", () => {
    expect(renderMasterPrompt(sampleAnalysis())).toBe(
      renderMasterPrompt(sampleAnalysis()),
    );
  });
});

describe("renderTicketPrompt", () => {
  it("no deja pasar adorno tampoco", () => {
    const analysis = adornedAnalysis();
    for (const ticket of analysis.tickets) {
      assertPlain(renderTicketPrompt(analysis, ticket.id));
    }
  });

  it("se entiende suelto: lleva Intención, problema y el Ticket entero", () => {
    const analysis = sampleAnalysis();
    const text = renderTicketPrompt(analysis, "t2");
    const ticket = analysis.tickets[1];

    expect(text).toContain("INTENCIÓN: Feature");
    expect(text).toContain(analysis.intent.rationale);
    expect(text).toContain(analysis.spec.problem);
    expect(text).toContain(`TICKET t2: ${ticket.title}`);
    expect(text).toContain(ticket.build);
    for (const check of ticket.checks) expect(text).toContain(`- [ ] ${check}`);
  });

  it("lleva TODAS las decisiones del Spec, no una selección", () => {
    const analysis = sampleAnalysis();
    for (const ticket of analysis.tickets) {
      const text = renderTicketPrompt(analysis, ticket.id);
      for (const decision of analysis.spec.decisions) {
        expect(text).toContain(decision);
      }
    }
  });

  it("no se inventa decisiones: cada línea listada está en el Spec", () => {
    const analysis = sampleAnalysis();
    const text = renderTicketPrompt(analysis, "t1");
    const listed = text
      .split("\n")
      .filter((line) => line.startsWith("- ") && !line.startsWith("- [ ]"))
      .map((line) => line.slice(2));
    for (const decision of listed) {
      expect(analysis.spec.decisions).toContain(decision);
    }
  });

  it("sin decisiones en el Spec no pinta un apartado vacío", () => {
    const analysis = sampleAnalysis();
    analysis.spec.decisions = [];
    expect(renderTicketPrompt(analysis, "t1")).not.toContain("DECISIONES");
  });

  it("no arrastra el resto de Tickets: se copia uno, no todos", () => {
    const text = renderTicketPrompt(sampleAnalysis(), "t1");
    expect(text).not.toContain("TICKET t3");
  });

  it("un id que no existe es un error, no un texto en blanco", () => {
    expect(() => renderTicketPrompt(sampleAnalysis(), "t99")).toThrow("t99");
  });
});
