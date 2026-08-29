"use client";

import { TREE_COPY, TREE_VIEWS, type TreeView } from "@/lib/constants";

/**
 * Cómo se ve el árbol: Canvas o Registro.
 *
 * Ocupa el sitio donde antes había un marcador de sección —un punto rojo y la
 * palabra «Registro»—, y eso es la decisión: la etiqueta que decía dónde
 * estabas se convierte en el interruptor que lo cambia, en vez de añadir un
 * control más a una cabecera que ya tenía cuatro cosas.
 *
 * El lenguaje de estado es el de `NavRow`, literalmente: pastilla `--accent`,
 * texto en rojo y el punto de 8 px. Un tercer significado de «activo» en la
 * misma pantalla sería un dialecto nuevo que nadie pidió.
 *
 * `aria-pressed` y no `role="tab"`: no hay panel que anunciar ni navegación
 * por flechas que implementar, son dos botones y uno está hundido.
 */

/** Canvas primero: es la vista que enseña la FORMA del árbol de un vistazo. */
const ORDER = [TREE_VIEWS.canvas, TREE_VIEWS.registro] as const;

export function ViewSwitch({
  view,
  onChange,
}: {
  view: TreeView;
  onChange: (view: TreeView) => void;
}) {
  return (
    <div
      role="group"
      aria-label={TREE_COPY.viewSwitch}
      className="flex w-fit items-center gap-1 rounded-full border border-border p-[3px]"
    >
      {ORDER.map((candidate) => {
        const active = view === candidate;
        return (
          <button
            key={candidate}
            type="button"
            onClick={() => onChange(candidate)}
            aria-pressed={active}
            className={`flex h-8 items-center gap-2 rounded-full px-3.5 text-[13px] tracking-[0.01em] transition-colors ${
              active
                ? "bg-accent text-primary"
                : "text-foreground hover:text-primary"
            }`}
          >
            {active ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-primary"
              />
            ) : null}
            {TREE_COPY.views[candidate]}
          </button>
        );
      })}
    </div>
  );
}
