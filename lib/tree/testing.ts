/**
 * Fixtures del dominio del árbol.
 *
 * Existe para que los tests de `model` y los de `serialize` construyan sus
 * Nodos con la MISMA fábrica: dos copias de un fixture divergen sin que nadie
 * lo note —un `orderIndex` por defecto distinto, una fecha distinta— y a
 * partir de ahí los dos archivos dejan de hablar del mismo árbol.
 *
 * Va en `lib/tree` y no junto a un test porque lo comparten dos, igual que
 * `lib/backend/testing/in-memory.ts` sirve a toda la contract suite.
 */

import type { TreeNode } from "@/lib/backend/ports";

/**
 * Una fecha fija.
 *
 * Fija y no `new Date()` porque el dominio no mira las fechas para nada: si
 * algún día una regla empezara a depender de ellas, los tests que la usan
 * fallarían de golpe en vez de pasar unas veces sí y otras no.
 */
export const FIXTURE_STAMP = new Date("2026-01-01T00:00:00.000Z");

/**
 * Un Nodo con lo mínimo que mira el dominio.
 *
 * `content` cae al id por defecto: en los tests de estructura el texto no
 * importa y repetirlo solo estorba, pero cuando un fallo se imprime, cada
 * Nodo se identifica solo.
 */
export function treeNode(
  id: string,
  parentId: string | null,
  orderIndex: number,
  content = id,
): TreeNode {
  return {
    id,
    versionId: "v1",
    parentId,
    content,
    orderIndex,
    createdAt: FIXTURE_STAMP,
    updatedAt: FIXTURE_STAMP,
  };
}
