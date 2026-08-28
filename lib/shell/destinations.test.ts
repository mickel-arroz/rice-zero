/**
 * Qué destino del shell se enciende para una ruta dada.
 *
 * Los tests están aquí y no en los componentes porque la sidebar y el menú
 * móvil pintan el MISMO estado desde el mismo sitio: si esta función se
 * equivoca, se equivocan los dos a la vez, y en la pantalla solo se ve «no se
 * marca nada» sin pista de por qué.
 */

import { describe, expect, it } from "vitest";

import { DESTINATIONS, activeDestination } from "@/lib/shell/destinations";
import { ROUTES } from "@/lib/constants";

describe("DESTINATIONS", () => {
  it("son los mismos en escritorio y en móvil", () => {
    // Una sola lista: el criterio de aceptación «los mismos destinos en ambos
    // formatos» se cumple por construcción y no por disciplina.
    expect(DESTINATIONS.map((d) => d.id)).toEqual(["projects", "about"]);
  });

  it("apunta a rutas del catálogo, nunca a literales sueltos", () => {
    expect(DESTINATIONS.map((d) => d.href)).toEqual([
      ROUTES.projects,
      ROUTES.about,
    ]);
  });
});

describe("activeDestination", () => {
  it("enciende el destino de su propia ruta", () => {
    expect(activeDestination(ROUTES.projects)).toBe("projects");
    expect(activeDestination(ROUTES.about)).toBe("about");
  });

  it("sigue encendido dentro de una subruta", () => {
    // Estar en un Proyecto es seguir estando en Proyectos: si el destino se
    // apagara al abrir uno, el usuario perdería la referencia de dónde está
    // justo cuando más navega.
    expect(activeDestination("/projects/abc")).toBe("projects");
    expect(activeDestination("/projects/abc/versions/2")).toBe("projects");
  });

  it("es indiferente a la barra final", () => {
    expect(activeDestination("/projects/")).toBe("projects");
    expect(activeDestination("/about/")).toBe("about");
  });

  it("no confunde un prefijo con un segmento", () => {
    // El mismo agujero que ataja `isPublicPath`: `/aboutus` no es `/about`.
    expect(activeDestination("/aboutus")).toBeNull();
    expect(activeDestination("/projectsx")).toBeNull();
  });

  it("no enciende nada fuera del shell", () => {
    expect(activeDestination(ROUTES.home)).toBeNull();
    expect(activeDestination(ROUTES.login)).toBeNull();
    expect(activeDestination("/cualquier-cosa")).toBeNull();
  });
});
