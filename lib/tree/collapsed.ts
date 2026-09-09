/**
 * Qué Nodos están plegados, y dónde se guarda eso.
 *
 * Un **Nodo plegado** (ver `CONTEXT.md`) es preferencia de quien mira, no
 * estado del Nodo: no viaja entre dispositivos, no cambia lo que la IA recibe
 * y no aparece en ninguna tabla. De ahí que viva en el navegador. Es la
 * diferencia exacta con el **Nodo completado**, que sí se persiste justo porque
 * altera el texto del Análisis, y una misma Versión tiene que dar el mismo
 * Análisis en cualquier dispositivo.
 *
 * ── Por qué `localStorage` y no una cookie ────────────────────────────────
 *
 * La barra lateral guarda su estado en cookie (`lib/shell/sidebar.ts`), y esto
 * se aparta de ese precedente A PROPÓSITO. Los dos motivos por los que allí es
 * cookie no se dan aquí:
 *
 *   1. **Tamaño.** Allí es un valor de una palabra. Aquí son identificadores de
 *      36 caracteres y pueden ser cientos — un árbol grande plegado por la
 *      mitad no cabe en los ~4 KB de una cookie, y la que se pasara se
 *      descartaría entera y en silencio.
 *   2. **Parpadeo.** Allí la cookie existe para que el SERVIDOR pinte el ancho
 *      correcto en el primer HTML. El árbol no se renderiza en servidor: llega
 *      por `fetch` después de hidratar, así que no hay un primer HTML que
 *      pudiera salir desplegado y encogerse.
 *
 * Y hay un tercer motivo para no mandarlo: una cookie viaja en CADA petición al
 * servidor, incluidas las de los datos. Mandar en cada llamada cuál de los
 * Nodos está doblado en una pantalla es pagar ancho de banda por un dato que
 * nadie del otro lado va a leer.
 *
 * Queda escrito aquí para que no se «corrija» de vuelta a cookie por parecerse
 * al vecino.
 *
 * ── Por Versión ───────────────────────────────────────────────────────────
 *
 * Una clave por Versión, y no una sola con todo dentro. Cada Versión es un
 * árbol completo e independiente (ver el glosario), así que abrir otra no puede
 * heredar lo que se dobló en ésta; y clonar una Versión no arrastra el plegado
 * de la original, porque los ids de sus Nodos son otros.
 *
 * Módulo puro: no toca `window`. Quien lee y escribe es el provider, que ya
 * está en un efecto de cliente. Así estas decisiones se prueban sin navegador.
 */

const PREFIX = "rice0.collapsed.";

/** Dónde se guarda el plegado de una Versión. */
export function collapsedKey(versionId: string): string {
  return `${PREFIX}${versionId}`;
}

/**
 * Los ids plegados que había guardados.
 *
 * Todo lo que no sea una lista de cadenas cuenta como «nada plegado»: ausente,
 * vacío, roto a medias por una pestaña que se cerró escribiendo, o escrito a
 * mano desde la consola. Es el mismo criterio que `isSidebarCollapsed` —un
 * valor que no se reconoce no puede dejar la interfaz en un tercer estado que
 * nadie diseñó—, y aquí importa más: el peor resultado posible sería un árbol
 * que se abre con ramas escondidas por un dato corrupto y sin decir por qué.
 */
export function parseCollapsed(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Lo que se escribe. Ordenado, y eso no es cosmético: sin orden, dos pliegues
 * que dejan el mismo conjunto producen cadenas distintas, y comparar lo
 * guardado con lo que hay —al depurar, o en un test— deja de decir nada.
 */
export function serializeCollapsed(ids: Iterable<string>): string {
  return JSON.stringify([...ids].sort());
}

/**
 * El conjunto con ese id dentro o fuera, según estuviera.
 *
 * Devuelve uno NUEVO y no muta el que recibe: es estado de React, y un `Set`
 * mutado en su sitio no repinta nada.
 */
export function toggleCollapsed(
  collapsed: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(collapsed);
  if (!next.delete(id)) next.add(id);
  return next;
}
