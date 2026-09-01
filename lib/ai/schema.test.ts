/**
 * El contrato de salida de la IA, afirmado.
 *
 * Lo que se prueba aquí no es «Zod sabe parsear»: son las reglas que el ADR
 * 0003 convierte en `refine` a propósito, porque una respuesta que las
 * incumple es una respuesta MALFORMADA y tiene que seguir el mismo camino de
 * error que un JSON corrupto — no colarse a medias y romper el panel después.
 */

import { describe, expect, it } from "vitest";

import { analysisSchema, INTENT_KINDS, type Analysis } from "@/lib/ai/schema";
import { sampleAnalysis } from "@/lib/ai/testing/samples";

/**
 * ¿Pasa el schema el Análisis de muestra con UN campo torcido?
 *
 * Se tuerce uno y no se escribe un objeto entero por caso: así, cuando un test
 * falla, lo que se lee en el diff es exactamente la regla que se estaba
 * probando y no un fixture de cuarenta líneas donde hay que buscarla.
 */
function accepts(mutate: (draft: Analysis) => void): boolean {
  const draft = sampleAnalysis();
  mutate(draft);
  return analysisSchema.safeParse(draft).success;
}

describe("el schema del Análisis", () => {
  it("acepta el Análisis de muestra", () => {
    expect(analysisSchema.safeParse(sampleAnalysis()).success).toBe(true);
  });

  it("cierra el enum de Intención: nada fuera de la lista entra", () => {
    expect(accepts((a) => {
      a.intent.kind = "proyecto-viejo" as never;
    })).toBe(false);

    for (const kind of INTENT_KINDS) {
      expect(accepts((a) => {
        a.intent.kind = kind;
      })).toBe(true);
    }
  });

  it("rechaza un Análisis sin ningún Ticket", () => {
    expect(accepts((a) => {
      a.tickets = [];
    })).toBe(false);
  });

  it("rechaza un Ticket sin Checks", () => {
    expect(accepts((a) => {
      a.tickets[0].checks = [];
    })).toBe(false);
  });

  it("rechaza un Spec sin Checks", () => {
    expect(accepts((a) => {
      a.spec.checks = [];
    })).toBe(false);
  });

  it("rechaza un `blockedBy` que apunta a un Ticket inexistente", () => {
    expect(accepts((a) => {
      a.tickets[1].blockedBy = ["t99"];
    })).toBe(false);
  });

  it("rechaza un Ticket que se bloquea a sí mismo", () => {
    expect(accepts((a) => {
      a.tickets[0].blockedBy = [a.tickets[0].id];
    })).toBe(false);
  });

  it("rechaza un ciclo largo de bloqueos", () => {
    expect(accepts((a) => {
      a.tickets[0].blockedBy = [a.tickets[2].id];
      a.tickets[1].blockedBy = [a.tickets[0].id];
      a.tickets[2].blockedBy = [a.tickets[1].id];
    })).toBe(false);
  });

  it("rechaza dos Tickets con el mismo id: `blockedBy` dejaría de ser una referencia", () => {
    expect(accepts((a) => {
      a.tickets[1].id = a.tickets[0].id;
    })).toBe(false);
  });

  it("rechaza un id de Ticket que no es un slug estable", () => {
    expect(accepts((a) => {
      a.tickets[0].id = "listado-de-productos";
      a.tickets[1].blockedBy = ["listado-de-productos"];
    })).toBe(false);
  });

  it("acepta `questions` vacío: un árbol completo no inventa preguntas", () => {
    expect(accepts((a) => {
      a.questions = [];
    })).toBe(true);
  });

  it("rechaza texto en blanco donde el contrato pide contenido", () => {
    expect(accepts((a) => {
      a.summary = "   ";
    })).toBe(false);

    expect(accepts((a) => {
      a.intent.rationale = "";
    })).toBe(false);

    expect(accepts((a) => {
      a.tickets[0].title = " ";
    })).toBe(false);
  });
});
