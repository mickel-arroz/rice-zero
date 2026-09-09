/**
 * El mapa de teclado del árbol.
 *
 * Los dos primeros bloques son tablas que barren el mapa ENTERO y afirman sus
 * dos reglas de una vez: ningún atajo sin modificador, y ninguno encima de una
 * tecla del navegador, del sistema o de la distribución. Escritas atajo por
 * atajo, la primera asignación nueva que las rompiera pasaría sin que nadie se
 * enterase — que es exactamente el fallo que este módulo existe para no tener.
 */

import { describe, expect, it } from "vitest";

import {
  isTypingStroke,
  resolveTreeKey,
  type KeyStroke,
  type TreeKeyContext,
} from "@/lib/tree/keymap";

/** Una pulsación, con todo apagado salvo lo que se diga. */
function stroke(key: string, mods: Partial<KeyStroke> = {}): KeyStroke {
  return { key, ctrl: false, meta: false, shift: false, alt: false, ...mods };
}

/** Los tres contextos posibles. `editing` implica `selected`. */
const CONTEXTS: Record<string, TreeKeyContext> = {
  "sin nada seleccionado": { selected: false, editing: false },
  "con un Nodo seleccionado": { selected: true, editing: false },
  "escribiendo dentro de un Nodo": { selected: true, editing: true },
};

/**
 * Todas las teclas que este mapa nombra, más un puñado de las que no.
 *
 * Se barren con TODAS las combinaciones de modificadores, así que la tabla
 * cubre lo asignado y lo que quedó libre por igual.
 */
const KEYS = [
  "Enter",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Backspace",
  " ",
  "Escape",
  "Tab",
  "Delete",
  "a",
  "ñ",
  "7",
  "@",
  "F5",
];

/** Las dieciséis combinaciones de los cuatro modificadores. */
function everyModifierCombo(): Array<Partial<KeyStroke>> {
  const combos: Array<Partial<KeyStroke>> = [];
  for (const ctrl of [false, true]) {
    for (const meta of [false, true]) {
      for (const shift of [false, true]) {
        for (const alt of [false, true]) {
          combos.push({ ctrl, meta, shift, alt });
        }
      }
    }
  }
  return combos;
}

describe("regla 1: ningún atajo sin modificador", () => {
  for (const [name, context] of Object.entries(CONTEXTS)) {
    it(`${name}, una tecla sola nunca dispara una acción`, () => {
      for (const key of KEYS) {
        for (const shift of [false, true]) {
          const sinMando = stroke(key, { shift });
          expect(
            resolveTreeKey(sinMando, context),
            `${shift ? "Shift+" : ""}${key} debería dejar pasar la tecla`,
          ).toBeNull();
        }
      }
    });
  }

  it("y escribir nunca dispara una acción", () => {
    // La otra cara de la misma regla: lo que `isTypingStroke` reconoce como
    // texto tiene que ser exactamente lo que el resolutor deja pasar.
    for (const key of KEYS) {
      for (const mods of everyModifierCombo()) {
        const s = stroke(key, mods);
        if (!isTypingStroke(s)) continue;

        for (const context of Object.values(CONTEXTS)) {
          expect(
            resolveTreeKey(s, context),
            `${key} es texto y no puede ser también un atajo`,
          ).toBeNull();
        }
      }
    }
  });
});

describe("regla 2: ninguna tecla del navegador, del sistema ni del teclado", () => {
  it("no hay ni un atajo sobre una LETRA o una cifra", () => {
    // Casi todo `Ctrl`/`Cmd`+letra está cogido por el navegador, y su capa con
    // `Shift` por las herramientas de desarrollo. El mapa entero se construye
    // sobre flechas, Enter, Espacio y Retroceso justo para no entrar ahí.
    for (const key of ["a", "ñ", "7", "@", "s", "f", "p", "d", "n", "t", "w"]) {
      for (const mods of everyModifierCombo()) {
        for (const context of Object.values(CONTEXTS)) {
          expect(
            resolveTreeKey(stroke(key, mods), context),
            `«${key}» no puede llevar atajo`,
          ).toBeNull();
        }
      }
    }
  });

  it("`Alt` no participa en ninguno", () => {
    // En un teclado español `Ctrl+Alt` ES `AltGr`, y esta app se escribe en
    // español: cada arroba tecleada con el Nodo enfocado pasaría por aquí.
    for (const key of KEYS) {
      for (const shift of [false, true]) {
        for (const context of Object.values(CONTEXTS)) {
          expect(
            resolveTreeKey(stroke(key, { ctrl: true, alt: true, shift }), context),
            `Ctrl+Alt+${key} es AltGr en media Europa`,
          ).toBeNull();
        }
      }
    }
  });

  it("Escape se deja pasar: lo atiende el campo, no el mapa", () => {
    for (const mods of everyModifierCombo()) {
      for (const context of Object.values(CONTEXTS)) {
        expect(resolveTreeKey(stroke("Escape", mods), context)).toBeNull();
      }
    }
  });

  it("Tab se deja pasar: el orden de tabulación no es del árbol", () => {
    for (const mods of everyModifierCombo()) {
      for (const context of Object.values(CONTEXTS)) {
        expect(resolveTreeKey(stroke("Tab", mods), context)).toBeNull();
      }
    }
  });
});

describe("con un Nodo seleccionado", () => {
  const sel = CONTEXTS["con un Nodo seleccionado"];

  /** Lo mismo con Ctrl y con Cmd: el mapa acepta los dos en todas partes. */
  function bothModifiers(key: string, extra: Partial<KeyStroke> = {}) {
    return [
      resolveTreeKey(stroke(key, { ctrl: true, ...extra }), sel),
      resolveTreeKey(stroke(key, { meta: true, ...extra }), sel),
    ];
  }

  it("Ctrl y Cmd hacen lo mismo, sin mirar en qué sistema se está", () => {
    const [conCtrl, conCmd] = bothModifiers("Enter");
    expect(conCtrl).toBe("createSibling");
    expect(conCmd).toBe("createSibling");
  });

  it.each([
    ["Enter", {}, "createSibling"],
    ["Enter", { shift: true }, "createChild"],
    ["ArrowUp", {}, "focusPrev"],
    ["ArrowDown", {}, "focusNext"],
    ["ArrowUp", { shift: true }, "moveUp"],
    ["ArrowDown", { shift: true }, "moveDown"],
    ["ArrowLeft", {}, "collapse"],
    ["ArrowRight", {}, "expand"],
    ["ArrowLeft", { shift: true }, "reparent"],
    [" ", { shift: true }, "toggleCompleted"],
    ["Backspace", {}, "remove"],
  ] as const)("Mod+%s%s → %s", (key, extra, action) => {
    for (const resolved of bothModifiers(key, extra)) {
      expect(resolved).toBe(action);
    }
  });

  it("Mod+Shift+→ se queda libre a propósito", () => {
    // Rellenarla por simetría es cómo se acaba con un atajo que nadie recuerda
    // haciendo algo que nadie quería.
    for (const resolved of bothModifiers("ArrowRight", { shift: true })) {
      expect(resolved).toBeNull();
    }
  });
});

describe("escribiendo dentro de un Nodo, el teclado es del texto", () => {
  const editing = CONTEXTS["escribiendo dentro de un Nodo"];

  it("solo sobreviven los dos atajos de crear", () => {
    expect(resolveTreeKey(stroke("Enter", { ctrl: true }), editing)).toBe(
      "createSibling",
    );
    expect(
      resolveTreeKey(stroke("Enter", { ctrl: true, shift: true }), editing),
    ).toBe("createChild");
  });

  it.each([
    ["ArrowLeft", {}],
    ["ArrowRight", {}],
    ["ArrowUp", {}],
    ["ArrowDown", {}],
    ["ArrowUp", { shift: true }],
    ["Backspace", {}],
    [" ", { shift: true }],
  ] as const)("Mod+%s%s se lo queda el campo", (key, extra) => {
    // `Ctrl+←` salta de palabra y `Ctrl+Shift+↑` selecciona hacia arriba: son
    // del `textarea`, y quitárselas sería pisar lo que alguien escribe.
    expect(
      resolveTreeKey(stroke(key, { ctrl: true, ...extra }), editing),
    ).toBeNull();
  });
});

describe("sin nada seleccionado", () => {
  const none = CONTEXTS["sin nada seleccionado"];

  it("mover el foco es cómo se ENTRA al árbol desde el teclado", () => {
    expect(resolveTreeKey(stroke("ArrowDown", { ctrl: true }), none)).toBe(
      "focusNext",
    );
    expect(resolveTreeKey(stroke("ArrowUp", { ctrl: true }), none)).toBe(
      "focusPrev",
    );
  });

  it("y nada más: sin Nodo no hay Nodo al que hacerle nada", () => {
    for (const key of ["Enter", "Backspace", "ArrowLeft", "ArrowRight", " "]) {
      for (const shift of [false, true]) {
        expect(
          resolveTreeKey(stroke(key, { ctrl: true, shift }), none),
        ).toBeNull();
      }
    }
  });
});

describe("isTypingStroke", () => {
  it("un carácter suelto es texto", () => {
    expect(isTypingStroke(stroke("a"))).toBe(true);
    expect(isTypingStroke(stroke("Ñ", { shift: true }))).toBe(true);
    expect(isTypingStroke(stroke("7"))).toBe(true);
    expect(isTypingStroke(stroke("@"))).toBe(true);
  });

  it("una tecla con nombre no lo es", () => {
    for (const key of ["Enter", "ArrowUp", "Escape", "Tab", "Dead", "F5"]) {
      expect(isTypingStroke(stroke(key))).toBe(false);
    }
  });

  it("con modificador de mando deja de ser texto", () => {
    expect(isTypingStroke(stroke("a", { ctrl: true }))).toBe(false);
    expect(isTypingStroke(stroke("a", { meta: true }))).toBe(false);
    expect(isTypingStroke(stroke("a", { alt: true }))).toBe(false);
  });

  it("el espacio no: en un botón enfocado significa «púlsame»", () => {
    expect(isTypingStroke(stroke(" "))).toBe(false);
  });
});
