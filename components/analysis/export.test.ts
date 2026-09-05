import { describe, expect, it } from "vitest";

import { fileStamp, masterExport, ticketExport } from "@/components/analysis/export";
import { adornedAnalysis, sampleAnalysis } from "@/lib/ai/testing/samples";
import { renderMasterPrompt, renderTicketPrompt } from "@/lib/ai";
import type { Analysis } from "@/lib/backend/ports";

/**
 * Un Análisis guardado, con la fecha que va a acabar en el nombre del archivo.
 *
 * La hora es local a propósito —`new Date(2026, 8, 5, 14, 32)` y no una cadena
 * ISO— porque el sello del nombre también lo es: quien descarga dos Análisis
 * el mismo día los distingue por SU reloj, no por UTC.
 */
function stored(createdAt: Date): Analysis {
  return {
    id: "an-1",
    versionId: "v-1",
    userGuidelines: null,
    provider: "gemini",
    model: "gemini-2.5-flash",
    content: sampleAnalysis(),
    createdAt,
  };
}

describe("fileStamp", () => {
  it("sella con fecha y hora locales, con ceros por delante", () => {
    expect(fileStamp(new Date(2026, 8, 5, 9, 4))).toBe("2026-09-05-0904");
  });

  it("dos Análisis del mismo día pero distinta hora no comparten sello", () => {
    const manana = fileStamp(new Date(2026, 8, 5, 9, 4));
    const tarde = fileStamp(new Date(2026, 8, 5, 14, 32));

    expect(manana).not.toBe(tarde);
  });
});

describe("masterExport", () => {
  /**
   * El criterio de aceptación literal del ticket, hecho aserción: «el `.md`
   * descargado es byte a byte la salida del renderer».
   *
   * Se compara con `toBe` contra la llamada al renderer y no contra un texto
   * escrito a mano, y esa es la única forma de que la prueba siga sirviendo
   * cuando el renderer cambie: lo que se afirma no es el FORMATO —eso ya lo
   * prueba `lib/ai/render.test.ts`— sino que esta capa no pone ni quita nada
   * por el camino. Una cabecera «Generado por RICE(0)», una fecha o un salto
   * de línea de más rompen esto.
   */
  it("no añade ni una línea a lo que escribe el renderer", () => {
    const analysis = stored(new Date(2026, 8, 5, 14, 32));

    expect(masterExport(analysis).text).toBe(renderMasterPrompt(analysis.content));
  });

  it("tampoco lo hace cuando el contenido traía adorno del modelo", () => {
    const analysis = { ...stored(new Date(2026, 8, 5, 14, 32)), content: adornedAnalysis() };

    expect(masterExport(analysis).text).toBe(renderMasterPrompt(analysis.content));
  });

  it("nombra el archivo con el sello del Análisis", () => {
    expect(masterExport(stored(new Date(2026, 8, 5, 14, 32))).filename).toBe(
      "rice0-master-2026-09-05-1432.md",
    );
  });
});

describe("ticketExport", () => {
  it("no añade ni una línea a lo que escribe el renderer", () => {
    const analysis = stored(new Date(2026, 8, 5, 14, 32));

    expect(ticketExport(analysis, "t2").text).toBe(
      renderTicketPrompt(analysis.content, "t2"),
    );
  });

  /**
   * El id va crudo en el nombre y no se sanea, y se puede afirmar: el schema
   * lo obliga a ser `t` y un número (`/^t\d+$/`), así que no hay ningún id
   * legal que necesite escaparse para un sistema de archivos. Si mañana el
   * schema abriera la mano, esta prueba es la que hay que venir a mirar.
   */
  it("nombra el archivo por el Ticket, para que dos no se pisen", () => {
    const analysis = stored(new Date(2026, 8, 5, 14, 32));

    expect(ticketExport(analysis, "t1").filename).toBe("rice0-t1-2026-09-05-1432.md");
    expect(ticketExport(analysis, "t3").filename).toBe("rice0-t3-2026-09-05-1432.md");
  });

  it("un Ticket que no existe es un fallo de quien llama, no un archivo vacío", () => {
    expect(() => ticketExport(stored(new Date(2026, 8, 5, 14, 32)), "t99")).toThrow();
  });
});
