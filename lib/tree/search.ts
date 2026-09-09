/**
 * Buscar un Nodo DENTRO de la Versión: filtrar en memoria.
 *
 * Esto y la Búsqueda global se parecen y no son la misma función, y la
 * diferencia está en el precio. Aquí el árbol ya está cargado entero en el
 * cliente —lo trajo `TreeProvider` al abrir la pantalla—, así que filtrar es
 * recorrer una lista que ya se tiene: responde en el mismo fotograma, sin red y
 * sin nada que esperar. Por eso no hay indicador de carga: pintar un esqueleto
 * aquí sería fingir una espera que no existe.
 *
 * Función pura sobre las filas que la vista ya calculó, no un hook: así lo que
 * decide qué encuentra la Búsqueda se puede comprobar sin montar nada, y la
 * pantalla se queda con el cableado.
 */

import type { TreeRow } from "@/lib/tree/rows";

/**
 * Un Nodo encontrado, con el camino que lo sitúa.
 *
 * El camino viaja con el resultado y no se busca después: la lista de
 * resultados rompe el árbol —los Nodos salen sueltos, sin sus líneas— y sin
 * decir de dónde cuelga cada uno, tres coincidencias parecidas son
 * indistinguibles. Es lo que el boceto pinta debajo de cada resultado.
 */
export type NodeMatch = {
  row: TreeRow;
  /** Los textos de sus antepasados, de la raíz hacia abajo. Sin el suyo. */
  ancestors: string[];
};

/**
 * El texto, listo para comparar: sin mayúsculas y sin tildes.
 *
 * Sin tildes a propósito, y no es un detalle: la app se escribe en español, y
 * quien busca «analisis» con prisa espera encontrar «Análisis». Hacer que la
 * tilde importe convierte la Búsqueda en un examen de ortografía.
 *
 * `NFD` separa cada letra de su acento y el rango de abajo quita los acentos.
 * Ese rango salta U+0303 —la virgulilla— a propósito: la `ñ` también se
 * descompone, y borrarla haría que «año» y «ano» fueran la misma palabra. Es la
 * excepción que separa «no exigir ortografía» de «cambiar lo que dice el
 * texto».
 */
function comparable(text: string): string {
  return foldedWithMap(text).folded;
}

/**
 * El texto comparable Y de qué carácter del original sale cada uno de los suyos.
 *
 * El mapa existe por el resaltado. `NFD` parte una letra acentuada en dos —«á»
 * pasa a ser «a» más una marca— y quitar la marca deja una cadena de OTRA
 * longitud, así que un índice encontrado sobre el texto comparable no señala el
 * mismo sitio en el texto que la persona escribió. Con el mapa sí: cada
 * posición de lo comparable sabe de dónde vino.
 *
 * Se recorre por PUNTO DE CÓDIGO (`for…of`) y no por unidad UTF-16: un emoji
 * dentro de un Nodo ocupa dos unidades, y contar por unidades desplazaría el
 * subrayado de todo lo que fuera detrás.
 */
function foldedWithMap(text: string): { folded: string; at: number[] } {
  let folded = "";
  const at: number[] = [];
  let index = 0;

  for (const character of text) {
    const stripped = character
      .normalize("NFD")
      .replace(/[̀-̂̄-ͯ]/g, "")
      .toLowerCase();

    // Una entrada por carácter de lo comparable: quitar una tilde deja dos
    // caracteres donde había uno, y los dos apuntan al mismo original.
    for (let i = 0; i < stripped.length; i += 1) at.push(index);
    folded += stripped;
    index += character.length;
  }

  // Un cierre, para que el final de la última coincidencia tenga a dónde mirar.
  at.push(text.length);
  return { folded, at };
}

/**
 * ¿Este texto contiene lo buscado?
 *
 * Subcadena y no palabras sueltas ni orden libre: es un filtro sobre lo que se
 * está mirando, no un motor de búsqueda. Quien teclea «tecl» quiere ver
 * «teclado» antes de terminar la palabra, y eso es exactamente lo que hace que
 * filtrar mientras se escribe valga la pena.
 */
export function matches(content: string, query: string): boolean {
  return comparable(content).includes(comparable(query));
}

/**
 * ¿Hay algo que filtrar?
 *
 * Una Búsqueda en blanco —o solo espacios— no filtra nada: enseña el árbol
 * entero. Existe como función y no como un `query.trim() !== ""` suelto porque
 * lo preguntan la pantalla —para decidir si pinta el árbol o los resultados— y
 * la prueba de extremo a extremo, y dos versiones de «está vacía» acabarían
 * discrepando en el caso del espacio.
 */
export function isSearching(query: string): boolean {
  return query.trim().length > 0;
}

/**
 * Los Nodos de la Versión que contienen lo buscado, en orden de lectura.
 *
 * Se busca sobre TODAS las filas y no sobre las visibles: un Nodo plegado sigue
 * existiendo, y no encontrarlo por tener doblada su rama sería justo lo
 * contrario de para lo que existe buscar. El plegado es de quien mira; la
 * Búsqueda es de lo que hay.
 *
 * Los antepasados se acumulan en una pila indexada por profundidad, que se
 * puede porque las filas vienen en orden de lectura: cuando llega una fila de
 * profundidad `d`, sus antepasados son exactamente los `d` últimos que se
 * anotaron por encima. Buscarlos por `parentId` costaría un recorrido por
 * resultado.
 */
export function searchRows(rows: TreeRow[], query: string): NodeMatch[] {
  if (!isSearching(query)) return [];

  const found: NodeMatch[] = [];
  /** `path[d]` es el texto de la fila de profundidad `d` más reciente. */
  const path: string[] = [];

  for (const row of rows) {
    path[row.depth] = row.node.content;
    if (matches(row.node.content, query)) {
      found.push({ row, ancestors: path.slice(0, row.depth) });
    }
  }

  return found;
}

/**
 * Dónde empieza y dónde acaba la coincidencia DENTRO del texto original.
 *
 * Existe para que el resaltado no tenga que comparar por su cuenta. Sin esto,
 * la lista de resultados acababa haciendo su propio `indexOf` en minúsculas —
 * una segunda regla, más débil que ésta, que no sabía de tildes: quien buscaba
 * «analisis» encontraba «Análisis» y no se le subrayaba nada, porque las dos
 * comparaciones no estaban de acuerdo. Una sola regla, y aquí, donde tiene test.
 *
 * Devuelve índices del texto CRUDO, listos para `slice`: lo que se pinta es lo
 * que la persona escribió, con sus tildes y sus mayúsculas.
 *
 * `null` cuando no hay coincidencia, que es lo mismo que contesta `matches`.
 */
export function matchRange(
  text: string,
  query: string,
): { start: number; end: number } | null {
  const needle = comparable(query);
  if (needle.length === 0) return null;

  const { folded, at } = foldedWithMap(text);
  const found = folded.indexOf(needle);
  if (found === -1) return null;

  return { start: at[found], end: at[found + needle.length] };
}
