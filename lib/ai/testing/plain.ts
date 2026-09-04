/**
 * «Sin adorno», como afirmación.
 *
 * Vive aquí y no dentro de `render.test.ts` porque lo comprueban DOS suites: la
 * del renderer, contra un Análisis con adorno metido a mano
 * (`adornedAnalysis`), y la corrida en vivo, contra lo que de verdad escribió
 * Gemini. Dos copias de esta lista negra dejarían de ser la misma promesa en
 * cuanto alguien añadiera un carácter a una — y la que se quedaría corta sería
 * justo la que mira la salida del modelo real.
 *
 * La lista la fija `CONTEXT.md` → Master Prompt: `- `, `1. `, `- [ ]` y líneas
 * de título, y nada más.
 */

import { expect } from "vitest";

/** Lo prohibido, tal cual lo enumera `CONTEXT.md` → Master Prompt. */
export const FORBIDDEN_MARKUP: [name: string, pattern: RegExp][] = [
  ["negritas o cursivas con asterisco", /\*/],
  ["cursivas o negritas con guion bajo", /_/],
  ["encabezados con almohadilla", /#/],
  ["tablas", /\|/],
  ["code fences o código en línea", /`/],
  ["tachado", /~/],
  ["emojis", /\p{Extended_Pictographic}/u],
];

/**
 * Falla si el texto lleva adorno, diciendo cuál y dónde.
 *
 * El mensaje incluye la coincidencia porque el caso que importa es el de la
 * corrida en vivo: ahí el texto lo escribió un modelo, y «lleva un asterisco»
 * sin decir dónde deja a quien lo lea buscándolo en un Master Prompt entero.
 */
export function assertPlainText(text: string): void {
  for (const [name, pattern] of FORBIDDEN_MARKUP) {
    expect(pattern.test(text), `${name}: ${pattern.exec(text)?.[0]}`).toBe(false);
  }
}
