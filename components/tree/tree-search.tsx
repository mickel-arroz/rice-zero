"use client";

import { CloseIcon } from "@/components/icons/close-icon";
import { InfoIcon } from "@/components/icons/info-icon";
import { SearchIcon } from "@/components/icons/search-icon";
import { STRUCK_CLASS } from "@/components/layout/site-chrome";
import { useTree } from "@/components/tree/tree-provider";
import { TREE_COPY } from "@/lib/constants";
import { matches, searchRows, type NodeMatch } from "@/lib/tree/search";

/**
 * La Búsqueda dentro de la Versión: el campo y sus resultados.
 *
 * Aquí no se decide qué encuentra: eso lo contesta `lib/tree/search.ts`, que es
 * puro y tiene test. Esto pinta.
 *
 * ── Lo que este componente NO tiene ───────────────────────────────────────
 *
 * No tiene indicador de carga, ni esqueleto, ni estado «buscando». El árbol ya
 * está cargado entero en el cliente, así que filtrar ocurre en el mismo
 * fotograma en que se teclea: no hay nada que esperar, y pintar una espera que
 * no existe sería mentir sobre lo que cuesta. La Búsqueda global sí lo tiene, y
 * esa diferencia es deliberada — son dos funciones con precios opuestos.
 *
 * Tampoco tiene rebote. Rebotar existe para no mandar una petición por tecla, y
 * aquí no sale ninguna.
 */

/**
 * El campo, ya con su cuenta puesta.
 *
 * Es lo que monta la pantalla. La cuenta se resuelve aquí dentro y no se le
 * pide al llamante porque sale del mismo filtro que los resultados: pasarla
 * como prop habría dejado dos sitios calculándola, y el día que discreparan el
 * campo diría «3 de 126» sobre una lista de cuatro.
 */
export function TreeSearch({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const { found, total } = useSearchCounts(query);
  return (
    <TreeSearchField query={query} onQuery={onQuery} found={found} total={total} />
  );
}

/** El campo, con su cuenta y su equis. */
function TreeSearchField({
  query,
  onQuery,
  found,
  total,
}: {
  query: string;
  onQuery: (value: string) => void;
  found: number;
  total: number;
}) {
  const active = query.length > 0;

  return (
    <div
      className={`flex h-13 shrink-0 items-center gap-3 rounded-full border bg-card px-5 transition-colors ${
        active ? "border-primary" : "border-border focus-within:border-primary"
      }`}
    >
      <SearchIcon className={active ? "text-primary" : "text-muted-foreground"} />
      <input
        type="search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={TREE_COPY.searchPlaceholder}
        aria-label={TREE_COPY.searchLabel}
        // `search` en vez de `text` por la equis nativa de algunos navegadores,
        // que se apaga abajo: dos formas de limpiar el campo en el mismo sitio
        // se pisan, y la nuestra es la que se ve igual en todos.
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
      />
      {active ? (
        <>
          <span className="shrink-0 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
            {TREE_COPY.searchCount(found, total)}
          </span>
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label={TREE_COPY.searchClear}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </>
      ) : null}
    </div>
  );
}

/**
 * El texto de un resultado con lo buscado resaltado.
 *
 * Se parte por la coincidencia en vez de pintar HTML: el texto de un Nodo lo
 * escribe una persona, y meterlo en un `innerHTML` para poder subrayarlo es
 * abrir una puerta que no hace falta abrir.
 */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!matches(text, query)) return <>{text}</>;

  // Sobre el texto en crudo, no sobre el comparable: hay que devolver lo que la
  // persona escribió, con sus tildes y sus mayúsculas. Se busca sin ellas
  // —`matches` ya dijo que está— y se corta por índice.
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at === -1) {
    // Coincide por tilde, no por letra a letra. Resaltar el trozo exacto
    // exigiría mapear índices entre las dos formas del texto; no se hace, y se
    // devuelve entero: el resultado sigue siendo correcto, solo sin subrayar.
    return <>{text}</>;
  }

  const end = at + query.trim().length;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-accent px-0.5 text-primary">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/** Un resultado: el Nodo, y de dónde cuelga. */
function Result({
  hit,
  query,
  selected,
  onOpen,
}: {
  hit: NodeMatch;
  query: string;
  selected: boolean;
  onOpen: () => void;
}) {
  const text = hit.row.node.content.trim();
  const path = hit.ancestors
    .map((name) => name.trim() || "…")
    .join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-colors ${
          selected ? "border-primary bg-accent" : "border-border hover:border-primary"
        }`}
      >
        <span
          className={`text-sm leading-relaxed break-words ${
            hit.row.struck
              ? STRUCK_CLASS
              : text
                ? ""
                : "text-muted-foreground"
          }`}
        >
          {text ? (
            <Highlighted text={text} query={query} />
          ) : (
            TREE_COPY.searchUntitled
          )}
        </span>
        {/* El camino, que es lo que sitúa al Nodo: la lista rompe el árbol y
            sin esto tres coincidencias parecidas son indistinguibles. */}
        {path ? (
          <span className="text-[11px] text-muted-foreground">{path}</span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * Los resultados. Reemplazan al árbol mientras se está buscando.
 *
 * Pulsar uno lo SELECCIONA y limpia la Búsqueda, que es volver al árbol con el
 * Nodo ya señalado. Es lo que se quería al buscarlo — no leerlo en una lista,
 * sino llegar a él.
 */
export function TreeSearchResults({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const tree = useTree();
  // Sobre `rows` y no sobre `visibleRows`: un Nodo plegado sigue existiendo, y
  // no encontrarlo por tener doblada su rama sería lo contrario de para lo que
  // existe buscar.
  const hits = searchRows(tree.rows, query);

  return (
    <div className="flex flex-col gap-2.5">
      {hits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-3.5 text-[13px] text-muted-foreground">
          {TREE_COPY.searchEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {hits.map((hit) => (
            <Result
              key={hit.row.node.id}
              hit={hit}
              query={query}
              selected={tree.selectedId === hit.row.node.id}
              onOpen={() => {
                tree.select(hit.row.node.id);
                onQuery("");
              }}
            />
          ))}
        </ul>
      )}

      {/* Dicho en pantalla y no solo en el código: es la diferencia visible con
          la Búsqueda global, que sí espera. Sin la frase, que una no tenga
          indicador de carga y la otra sí se lee como un descuido. */}
      <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-3.5 text-xs text-muted-foreground">
        <InfoIcon width={16} height={16} className="shrink-0" />
        {TREE_COPY.searchLocal}
      </p>
    </div>
  );
}

/** Cuántos Nodos hay ahora mismo, para la cuenta del campo. */
function useSearchCounts(query: string) {
  const tree = useTree();
  return {
    found: searchRows(tree.rows, query).length,
    total: tree.rows.length,
  };
}
