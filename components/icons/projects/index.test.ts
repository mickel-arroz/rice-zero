/**
 * El registro es la única forma de ir de una clave guardada en base de datos a
 * un componente. Los tests están aquí y no en la UI porque la decisión que
 * puede romper una pantalla —«qué pinto si la clave no existe»— es esta, y una
 * lista de decenas de entradas escrita a mano se desincroniza sin que nada avise.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROJECT_ICON,
  PROJECT_ICON_KEYS,
  isProjectIconKey,
  projectIconFor,
  projectIconLabel,
} from "@/components/icons/projects";
import { NodeIcon } from "@/components/icons/projects/node-icon";
import { RocketIcon } from "@/components/icons/projects/rocket-icon";

/**
 * Las claves que ya pueden estar guardadas en filas de Proyecto. Escritas a
 * mano y no derivadas del catálogo a propósito: si alguien retira una del
 * catálogo, este test es lo único que lo nota antes de que un Proyecto real
 * caiga en silencio al icono por defecto (#63).
 */
const STORED_KEYS = [
  "node", "layers", "cube", "rocket", "bolt", "star", "heart", "flag", "bookmark",
  "book", "flask", "bulb", "compass", "pin", "globe", "terminal", "code",
  "database", "cloud", "chip", "phone", "monitor", "camera", "music", "palette",
  "bag", "briefcase", "leaf", "drop", "target",
];

const APP_CATEGORY_KEYS = [
  "wallet", "coin", "checklist", "calendar", "stethoscope", "dumbbell", "ball",
  "cart", "store", "chat", "graduation", "plane", "utensils",
];

describe("PROJECT_ICON_KEYS", () => {
  it("son 43, sin repetidos", () => {
    expect(PROJECT_ICON_KEYS).toHaveLength(43);
    expect(new Set(PROJECT_ICON_KEYS).size).toBe(43);
  });

  it("no retira ninguna clave que ya pueda estar guardada", () => {
    expect(PROJECT_ICON_KEYS).toEqual(expect.arrayContaining(STORED_KEYS));
  });

  it("incluye las categorías de app del #63", () => {
    expect(PROJECT_ICON_KEYS).toEqual(expect.arrayContaining(APP_CATEGORY_KEYS));
  });

  it("sigue empezando por el icono por defecto", () => {
    expect(PROJECT_ICON_KEYS[0]).toBe(DEFAULT_PROJECT_ICON);
  });

  it("no repite nombre visible: dos celdas con el mismo nombre no se distinguen", () => {
    const labels = PROJECT_ICON_KEYS.map(projectIconLabel);
    expect(new Set(labels).size).toBe(labels.length);
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
