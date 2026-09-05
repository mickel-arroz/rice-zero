/**
 * Texto de la app metido dentro de una expresión regular, sin sorpresas.
 *
 * Hace falta más de lo que parece: el nombre de la app lleva paréntesis
 * —`RICE(0)`— y el texto de un Nodo lo escribe quien escribe la prueba, así que
 * cualquiera de los dos puede traer un carácter que una regex lee como
 * sintaxis. Estaba escrito de tres maneras distintas en tres archivos, cada una
 * escapando un juego de caracteres distinto; ésta es la única, y escapa todos.
 */
export function literal(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
