/**
 * El registro es la única forma de ir de una clave guardada en base de datos a
 * un componente. Los tests están aquí y no en la UI porque la decisión que
 * puede romper una pantalla —«qué pinto si la clave no existe»— es esta, y una
 * lista de 30 entradas escrita a mano se desincroniza sin que nada avise.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_ICON,
  PROJECT_ICON_KEYS,
  isProjectIconKey,
  projectIconFor,
} from "@/components/icons/projects";
import { NodeIcon } from "@/components/icons/projects/node-icon";
import { RocketIcon } from "@/components/icons/projects/rocket-icon";

describe("PROJECT_ICON_KEYS", () => {
  it("son 30, sin repetidos", () => {
    expect(PROJECT_ICON_KEYS).toHaveLength(30);
    expect(new Set(PROJECT_ICON_KEYS).size).toBe(30);
  });

  it("incluye el icono por defecto", () => {
    expect(PROJECT_ICON_KEYS).toContain(DEFAULT_PROJECT_ICON);
  });

  it("tiene un componente para cada clave", () => {
    for (const key of PROJECT_ICON_KEYS) {
      expect(typeof projectIconFor(key)).toBe("function");
    }
  });
});

describe("isProjectIconKey", () => {
  it("reconoce una clave del catálogo", () => {
    expect(isProjectIconKey("rocket")).toBe(true);
    expect(isProjectIconKey(DEFAULT_PROJECT_ICON)).toBe(true);
  });

  it("rechaza lo que no está", () => {
    expect(isProjectIconKey("cohete")).toBe(false);
    expect(isProjectIconKey("")).toBe(false);
    // Nada de heredar de Object.prototype: `{}` no tiene un icono «toString».
    expect(isProjectIconKey("toString")).toBe(false);
  });
});

describe("projectIconFor", () => {
  it("devuelve el componente de la clave", () => {
    expect(projectIconFor("rocket")).toBe(RocketIcon);
  });

  it("cae al icono por defecto ante una clave desconocida", () => {
    // Una fila escrita por una versión anterior, o a mano, no puede tumbar la
    // lista entera: se pinta el nodo cero y se sigue.
    expect(projectIconFor("cohete")).toBe(NodeIcon);
    expect(projectIconFor("")).toBe(NodeIcon);
    expect(projectIconFor("toString")).toBe(NodeIcon);
  });
});
