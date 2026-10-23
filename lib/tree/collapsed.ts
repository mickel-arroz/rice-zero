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

import type { TreeRow } from "@/lib/tree/rows";

/** Dónde se guarda el plegado de una Versión. */
export function collapsedKey(versionId: string): string {
  return `rice0.collapsed.${versionId}`;
}

/**
 * Dónde se guardan los desplegados de una Versión. Clave aparte y no un
 * cambio de formato de la de plegados: lo que ya estaba guardado se sigue
 * leyendo tal cual.
 */
export function expandedKey(versionId: string): string {
  return `rice0.expanded.${versionId}`;
}

/**
 * Los ids que había guardados en una de las dos claves.
 *
 * Todo lo que no sea una lista de cadenas cuenta como «nada plegado»: ausente,
 * vacío, roto a medias por una pestaña que se cerró escribiendo, o escrito a
 * mano desde la consola. Es el mismo criterio que `isSidebarCollapsed` —un
 * valor que no se reconoce no puede dejar la interfaz en un tercer estado que
 * nadie diseñó—, y aquí importa más: el peor resultado posible sería un árbol
 * que se abre con ramas escondidas por un dato corrupto y sin decir por qué.
 */
export function parseIds(raw: string | null | undefined): Set<string> {
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
export function serializeIds(ids: Iterable<string>): string {
  return JSON.stringify([...ids].sort());
}

/* ── Los Nodos completados nacen plegados ──────────────────────────────── */

/**
 * Lo que quien mira ha decidido a mano, en dos conjuntos de excepciones.
 *
 * `collapsed` son los plegados de siempre. `expanded` son los Nodos
 * completados que se desplegaron a mano: un Nodo completado con hijos se ve
 * plegado SIN que nadie lo pida (ver **Nodo plegado** en `CONTEXT.md`), así
 * que abrirlo es lo que hay que recordar, no plegarlo.
 *
 * Lo que se ve NO se guarda: se deriva con `foldedIds`. Guardarlo obligaría a
 * reescribir el plegado cada vez que cambia una marca —también las que llegan
 * de otro dispositivo— y bastaría un olvido para que la pantalla y la marca
 * dejaran de cuadrar.
 */
export type Folds = {
  collapsed: ReadonlySet<string>;
  expanded: ReadonlySet<string>;
};

/** Sin ninguna excepción: lo que dicta la regla y nada más. */
export function emptyFolds(): Folds {
  return { collapsed: new Set(), expanded: new Set() };
}

/** Lo que el provider le pasa: `localStorage`, o un doble en los tests. */
type FoldStorage = Pick<Storage, "getItem" | "setItem">;

/** Las excepciones guardadas de una Versión. */
export function readFolds(storage: FoldStorage, versionId: string): Folds {
  return {
    collapsed: parseIds(storage.getItem(collapsedKey(versionId))),
    expanded: parseIds(storage.getItem(expandedKey(versionId))),
  };
}

/** Las guarda. Las dos claves van siempre juntas. */
export function writeFolds(
  storage: FoldStorage,
  versionId: string,
  folds: Folds,
): void {
  storage.setItem(collapsedKey(versionId), serializeIds(folds.collapsed));
  storage.setItem(expandedKey(versionId), serializeIds(folds.expanded));
}

/** Si la marca, por sí sola, pliega este Nodo. */
function foldsByItself(row: TreeRow): boolean {
  return row.node.completed && row.hasChildren;
}

/**
 * Los Nodos que se ven plegados:
 * `plegadoManual || (completado && tieneHijos && !desplegadoManual)`.
 */
export function foldedIds(rows: readonly TreeRow[], folds: Folds): Set<string> {
  const folded = new Set<string>();
  for (const row of rows) {
    const id = row.node.id;
    if (folds.collapsed.has(id)) folded.add(id);
    else if (foldsByItself(row) && !folds.expanded.has(id)) folded.add(id);
  }
  return folded;
}

/**
 * Pulsar el botón de plegar sobre `row`: lo que se ve pasa al estado
 * contrario, y las excepciones quedan como el mínimo que lo explica.
 *
 * Devuelve conjuntos NUEVOS y no muta los que recibe: es estado de React, y
 * un `Set` mutado en su sitio no repinta nada.
 */
export function toggleFold(folds: Folds, row: TreeRow): Folds {
  const id = row.node.id;
  const collapsed = new Set(folds.collapsed);
  const expanded = new Set(folds.expanded);

  if (!foldsByItself(row)) {
    // Pendiente, o sin hijos: el plegado de siempre.
    if (!collapsed.delete(id)) collapsed.add(id);
  } else if (foldedIds([row], folds).has(id)) {
    // Completado y plegado: abrirlo es la excepción. Se quita también de los
    // plegados a mano —uno de cuando estaba pendiente— para que baste un clic.
    collapsed.delete(id);
    expanded.add(id);
  } else {
    // Completado y desplegado a mano: volver a plegarlo es olvidar la
    // excepción. La regla lo pliega sola.
    expanded.delete(id);
  }

  return { collapsed, expanded };
}

/**
 * Desmarcar un Nodo olvida que se desplegó a mano: así volver a completarlo
 * lo pliega otra vez.
 *
 * Se aplica al ÁRBOL y no al gesto de desmarcar, para que cuente también la
 * marca que se quitó en otro dispositivo: lo que se mira es si el Nodo sigue
 * completado, venga de donde venga el cambio. Solo se olvidan los Nodos que
 * están en `rows` y pendientes; uno que no está —árbol aún sin cargar, o de
 * otra Versión mientras se cambia— no dice nada y se conserva.
 *
 * Sin nada que olvidar devuelve el MISMO objeto, para que React no repinte ni
 * se reescriba lo guardado.
 */
export function pruneExpanded(folds: Folds, rows: readonly TreeRow[]): Folds {
  const pending = rows.filter(
    (row) => !row.node.completed && folds.expanded.has(row.node.id),
  );
  if (pending.length === 0) return folds;
  const expanded = new Set(folds.expanded);
  for (const row of pending) expanded.delete(row.node.id);
  return { collapsed: folds.collapsed, expanded };
}
