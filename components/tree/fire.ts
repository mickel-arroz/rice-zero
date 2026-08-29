/**
 * Lanza una escritura del árbol sin esperarla.
 *
 * El `catch` vacío NO se traga el fallo: `TreeProvider` ya lo dejó en su estado
 * y la cabecera lo está enseñando con su frase. Lo que se traga es el rechazo
 * de la promesa, que sin esto llegaría a la consola como un error sin dueño —
 * el provider la relanza a propósito para que los diálogos sepan que no deben
 * cerrarse, y quien llama a esto no es un diálogo esperando.
 *
 * Está en su propio archivo porque lo usan cinco sitios de las dos vistas. Con
 * una copia por componente, el día que este `catch` deje de ser lo correcto
 * habría que acordarse de los cinco.
 */
export function fire(work: Promise<unknown>): void {
  void work.catch(() => {});
}
