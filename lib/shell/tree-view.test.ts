import { describe, expect, it } from "vitest";

import { TREE_VIEWS } from "@/lib/constants";
import {
  REMEMBERED_PROJECTS,
  TREE_VIEW_COOKIE,
  cookieValue,
  treeViewCookieAssignment,
  treeViewFor,
} from "@/lib/shell/tree-view";

/** Ids con la pinta de los de verdad: los que escribe el motor son uuid. */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("treeViewFor", () => {
  it("sin cookie se abre en Registro", () => {
    // El Registro es la vista de edición y la única que hay en móvil: abrir
    // ahí es lo que menos sorprende a quien entra por primera vez.
    expect(treeViewFor(undefined, A)).toBe(TREE_VIEWS.registro);
    expect(treeViewFor("", A)).toBe(TREE_VIEWS.registro);
  });

  it("un Proyecto anotado se abre en Canvas, y solo él", () => {
    expect(treeViewFor(`${A},${B}`, A)).toBe(TREE_VIEWS.canvas);
    expect(treeViewFor(`${A},${B}`, B)).toBe(TREE_VIEWS.canvas);
    expect(treeViewFor(`${A},${B}`, C)).toBe(TREE_VIEWS.registro);
  });

  it("una cookie con basura no rompe la pantalla", () => {
    // No es de fiar: la escribe el propio cliente y se puede tocar a mano.
    expect(treeViewFor("no-soy-un-id;  ,,,", A)).toBe(TREE_VIEWS.registro);
  });
});

describe("treeViewCookieAssignment", () => {
  /** Lo que quedaría guardado: la asignación es `nombre=valor; ...`. */
  function saved(assignment: string): string {
    return assignment.slice(
      TREE_VIEW_COOKIE.length + 1,
      assignment.indexOf(";"),
    );
  }

  it("dejar un Proyecto en Canvas lo anota", () => {
    expect(saved(treeViewCookieAssignment("", A, TREE_VIEWS.canvas))).toBe(A);
  });

  it("volver a Registro lo borra de la lista", () => {
    // Solo se anota lo que se APARTA de lo normal. Así la cookie no crece con
    // los Proyectos que se quedaron donde ya estaban.
    expect(
      saved(treeViewCookieAssignment(`${A},${B}`, A, TREE_VIEWS.registro)),
    ).toBe(B);
  });

  it("el último Proyecto tocado se pone el primero", () => {
    // El orden es lo que decide a quién se olvida al llegar al tope, así que
    // tiene que ser «el más reciente primero» y no el de llegada.
    expect(saved(treeViewCookieAssignment(`${A},${B}`, B, TREE_VIEWS.canvas)))
      .toBe(`${B},${A}`);
  });

  it("no se anota dos veces el mismo Proyecto", () => {
    expect(saved(treeViewCookieAssignment(A, A, TREE_VIEWS.canvas))).toBe(A);
  });

  it("recuerda solo los últimos, y olvida por el final", () => {
    // La cookie viaja en CADA petición: sin tope, alguien con cien Proyectos
    // acabaría mandando cuatro kilobytes en cada una hasta que el navegador
    // la tirase entera y se perdiera todo.
    const many = Array.from(
      { length: REMEMBERED_PROJECTS + 5 },
      (_, index) => `${index}`.padStart(8, "0") + A.slice(8),
    );
    const value = saved(
      treeViewCookieAssignment(many.join(","), C, TREE_VIEWS.canvas),
    );

    const kept = value.split(",");
    expect(kept).toHaveLength(REMEMBERED_PROJECTS);
    expect(kept[0]).toBe(C);
    expect(kept).not.toContain(many[many.length - 1]);
  });

  it("lo que se escribe es exactamente lo que se sabe leer", () => {
    // El motivo de que las dos funciones vivan juntas: una cookie que se
    // escribe en un formato y se lee en otro no falla, simplemente no recuerda.
    const assignment = treeViewCookieAssignment("", A, TREE_VIEWS.canvas);

    expect(treeViewFor(saved(assignment), A)).toBe(TREE_VIEWS.canvas);
    expect(assignment).toContain("path=/");
    expect(assignment).toContain("samesite=lax");
  });
});

describe("cookieValue", () => {
  it("saca el valor de entre las demás cookies", () => {
    expect(cookieValue("otra=1; rice0.tree-view=abc; mas=2", TREE_VIEW_COOKIE))
      .toBe("abc");
  });

  it("devuelve nada si no está", () => {
    expect(cookieValue("otra=1", TREE_VIEW_COOKIE)).toBeUndefined();
    expect(cookieValue("", TREE_VIEW_COOKIE)).toBeUndefined();
  });

  it("no confunde una cookie cuyo nombre la contiene", () => {
    // `rice0.tree-view-algo` empieza igual: sin comparar el nombre entero, se
    // leería su valor y la vista se recordaría al revés.
    expect(cookieValue("rice0.tree-view-algo=x", TREE_VIEW_COOKIE))
      .toBeUndefined();
  });
});
