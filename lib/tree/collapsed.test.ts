import { describe, expect, it } from "vitest";

import {
  collapsedKey,
  parseCollapsed,
  serializeCollapsed,
  toggleCollapsed,
} from "@/lib/tree/collapsed";

describe("Dónde se guarda el plegado", () => {
  it("una clave por Versión", () => {
    // Cada Versión es un árbol completo e independiente: abrir otra no puede
    // heredar lo que se dobló en ésta.
    expect(collapsedKey("v1")).not.toEqual(collapsedKey("v2"));
    expect(collapsedKey("v1")).toContain("v1");
  });
});

describe("Leer lo guardado", () => {
  it("lo escrito se vuelve a leer igual", () => {
    const ids = new Set(["b", "a"]);
    expect(parseCollapsed(serializeCollapsed(ids))).toEqual(ids);
  });

  it("se escribe ordenado, para que el mismo conjunto dé la misma cadena", () => {
    expect(serializeCollapsed(["b", "a"])).toEqual(serializeCollapsed(["a", "b"]));
  });

  it.each([
    ["nada guardado todavía", null],
    ["la cadena vacía", ""],
    ["a medio escribir", '["a"'],
    ["que no es una lista", '{"a":true}'],
    ["una lista de otra cosa", "[1,2,3]"],
  ])("%s cuenta como nada plegado", (_caso, raw) => {
    // El peor resultado posible sería un árbol que se abre con ramas
    // escondidas por un dato corrupto y sin decir por qué.
    expect(parseCollapsed(raw)).toEqual(new Set());
  });

  it("de una lista mixta se queda con las cadenas", () => {
    expect(parseCollapsed('["a",7,"b",null]')).toEqual(new Set(["a", "b"]));
  });
});

describe("Plegar y desplegar", () => {
  it("añade el que no estaba y quita el que sí", () => {
    expect(toggleCollapsed(new Set(), "a")).toEqual(new Set(["a"]));
    expect(toggleCollapsed(new Set(["a", "b"]), "a")).toEqual(new Set(["b"]));
  });

  it("no toca el conjunto que recibe", () => {
    // Es estado de React: un `Set` mutado en su sitio no repinta nada.
    const antes = new Set(["a"]);
    toggleCollapsed(antes, "b");
    expect(antes).toEqual(new Set(["a"]));
  });
});
