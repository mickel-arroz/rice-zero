"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { AlertIcon } from "@/components/icons/alert-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { SearchIcon } from "@/components/icons/search-icon";
import { LABEL_CLASS, STRUCK_CLASS } from "@/components/layout/site-chrome";
import type { NodeSearchHit } from "@/lib/backend/ports";
import { ROUTES, SEARCH_COPY, TREE_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { SEARCH_LIMIT, nodeService } from "@/lib/services/nodes";

/**
 * La Búsqueda global: encontrar dónde se escribió algo sin recordar en qué
 * Proyecto fue.
 *
 * Se parece a la Búsqueda dentro de la Versión y **no es la misma función**, y
 * todo lo que este archivo tiene de más sale de esa diferencia: aquí los datos
 * NO están cargados. La lista de Proyectos no tiene ni un árbol en memoria, así
 * que cada Búsqueda es una petición al motor — y con eso vienen el rebote, el
 * indicador de carga, el estado de error y el contador de peticiones en vuelo.
 * Allí no hay nada de eso porque no hay nada que esperar.
 *
 * ── El rebote ─────────────────────────────────────────────────────────────
 *
 * Existe aquí y no allí por el mismo motivo que en el Autoguardado: para no
 * mandar una petición por tecla. Es más largo que el del texto —300 contra
 * 500 ms— porque lo que se persigue es distinto: aquél no quiere perder una
 * idea, éste solo quiere no gastar una petición de más mientras alguien
 * termina de escribir una palabra.
 */

/** Cuánto se espera desde la última tecla antes de preguntar. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Lo último que CONTESTÓ el motor, y a qué palabra.
 *
 * Lleva dentro el término al que corresponde, y eso es lo que hace que
 * «buscando» no necesite ser un estado propio: se deduce comparando lo que hay
 * escrito con lo que hay contestado. Un `setState("loading")` en el cuerpo del
 * efecto habría sido un repintado en cascada por tecla, además de un estado más
 * que mantener de acuerdo con los otros.
 */
type Answer =
  | { term: string; hits: NodeSearchHit[] }
  | { term: string; error: string };

/** Una fila de resultado: el Nodo, y a qué Proyecto y Versión pertenece. */
function Hit({ hit }: { hit: NodeSearchHit }) {
  const text = hit.content.trim();
  const version = TREE_COPY.versionName(hit.versionNumber, hit.versionLabel);

  return (
    <li>
      {/* Enlace y no botón: lleva a otra pantalla, así que se puede abrir en
          otra pestaña, copiar y volver con el botón de atrás — que es lo que
          se espera de un resultado de búsqueda. */}
      <Link
        href={ROUTES.version(hit.projectId, hit.versionId)}
        className="flex flex-col gap-1.5 rounded-2xl border border-border p-3.5 transition-colors hover:border-primary"
      >
        <span
          className={`text-sm leading-relaxed break-words ${
            hit.completed ? STRUCK_CLASS : text ? "" : "text-muted-foreground"
          }`}
        >
          {text || SEARCH_COPY.untitled}
        </span>
        {/* La procedencia. Sin ella, «Autenticación» aparece tres veces y no
            hay forma de saber cuál es cuál. */}
        <span className="text-[11px] text-muted-foreground">
          {hit.projectTitle} · {version}
        </span>
      </Link>
    </li>
  );
}

export function GlobalSearch({ projectCount }: { projectCount: number }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);

  /**
   * Cuál es la Búsqueda vigente.
   *
   * Una respuesta lenta puede llegar después de una más nueva y pisarla, y
   * entonces la lista enseñaría los resultados de una palabra que ya no está en
   * el campo. Es el mismo contador que usan `TreeProvider` y `ProjectsProvider`
   * al cargar, por el mismo motivo.
   */
  const ticket = useRef(0);

  const term = query.trim();

  useEffect(() => {
    if (term.length === 0) return;

    const mine = ++ticket.current;
    const timer = setTimeout(() => {
      nodeService()
        .search(term)
        .then((hits) => {
          if (ticket.current === mine) setAnswer({ term, hits });
        })
        .catch((error: unknown) => {
          if (ticket.current === mine) {
            setAnswer({ term, error: errorMessage(error) });
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [term]);

  const active = query.length > 0;
  /** La respuesta sirve solo si es de lo que hay escrito AHORA. */
  const settled = answer?.term === term ? answer : null;
  /**
   * Se está esperando: hay algo escrito y todavía no ha contestado por ello.
   *
   * Incluye el rebote, y a propósito: durante esos trescientos milisegundos no
   * pasa nada en pantalla, y un campo que no responde se lee como una tecla
   * perdida. Y también incluye el caso de haber cambiado la palabra sobre unos
   * resultados ya pintados — que siguen ahí, pero son de otra pregunta.
   */
  const loading = term.length > 0 && settled === null;

  return (
    <div className="flex flex-col gap-3.5">
      <div
        className={`flex h-13 shrink-0 items-center gap-3 rounded-full border bg-card px-5 transition-colors ${
          active ? "border-primary" : "border-border focus-within:border-primary"
        }`}
      >
        <SearchIcon className={active ? "text-primary" : "text-muted-foreground"} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={SEARCH_COPY.placeholder}
          aria-label={SEARCH_COPY.label}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {active ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={SEARCH_COPY.clear}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
          >
            <CloseIcon width={16} height={16} />
          </button>
        ) : null}
      </div>

      {loading ? (
        // Aquí SÍ: la petición viaja. Es la silueta de lo que viene, con el
        // mismo alto que van a tener las filas para que no dé un salto.
        <div
          aria-busy="true"
          aria-label={SEARCH_COPY.loading}
          className="flex flex-col gap-2.5"
        >
          {[0, 1, 2].map((row) => (
            <span
              key={row}
              className="h-[74px] rounded-2xl border border-border bg-accent/40"
            />
          ))}
        </div>
      ) : null}

      {settled && "error" in settled ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-border p-3.5 text-[13px] leading-relaxed"
        >
          <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <strong className="font-bold">{SEARCH_COPY.errorTitle}</strong>{" "}
            <span className="text-muted-foreground">{settled.error}</span>
          </span>
        </div>
      ) : null}

      {settled && "hits" in settled && settled.hits.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border p-5">
          <p className="text-[15px] font-bold">
            {SEARCH_COPY.emptyTitle(term)}
          </p>
          {/* Dice DÓNDE se buscó: sin eso, quien no encuentra nada no sabe si
              descartar la palabra o el sitio. */}
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {SEARCH_COPY.emptyBody(projectCount)}
          </p>
        </div>
      ) : null}

      {settled && "hits" in settled && settled.hits.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <p className={LABEL_CLASS}>{SEARCH_COPY.resultsLabel}</p>
          <ul className="flex flex-col gap-2.5">
            {settled.hits.map((hit) => (
              <Hit key={hit.id} hit={hit} />
            ))}
          </ul>
          {/* Cuando el tope recorta se dice, en vez de fingir que eso era
              todo: una lista cortada en silencio es una respuesta equivocada. */}
          {settled.hits.length === SEARCH_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              {SEARCH_COPY.capped(SEARCH_LIMIT)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
