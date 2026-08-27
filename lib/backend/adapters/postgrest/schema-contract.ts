/**
 * Cómo un adaptador afirma que sus tipos generados encajan con `rows.ts`.
 *
 * `database.types.ts` es generado y vive dentro de cada adaptador; el núcleo
 * compartido trabaja contra `rows.ts`. Este archivo es el único sitio donde se
 * comprueba que las dos cosas describen el mismo esquema, y lo hace en tiempo de
 * typecheck: si una migración cambia una columna y los tipos se regeneran, el
 * error sale en el `schema-check.ts` del adaptador y no en producción.
 */

/**
 * Igualdad exacta de tipos, no asignabilidad: `Exact<{a: string}, {a: string;
 * b: number}>` falla, mientras que `extends` lo dejaría pasar. Es lo que hace
 * que una columna nueva y sin mapear rompa el typecheck.
 */
export type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
