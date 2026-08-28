"use client";

import { useRef } from "react";

import {
  PROJECT_ICON_KEYS,
  projectIconFor,
  projectIconLabel,
  type ProjectIconKey,
} from "@/components/icons/projects";
import { LABEL_CLASS } from "@/components/layout/site-chrome";
import { PROJECTS_COPY } from "@/lib/constants";

/** Cuántas celdas por fila en cada formato. Lo necesitan las flechas. */
const COLUMNS = { phone: 5, desktop: 10 } as const;

/** A dónde lleva cada flecha, en número de celdas. */
const STEP: Record<string, (columns: number) => number> = {
  ArrowRight: () => 1,
  ArrowLeft: () => -1,
  ArrowDown: (columns) => columns,
  ArrowUp: (columns) => -columns,
};

/**
 * El selector de icono: los 30 del catálogo, todos a la vista.
 *
 * Sin scroll ni «ver más» a propósito. En un teléfono de 390 px caben cinco
 * columnas de 52 px y las seis filas entran bajo los dos campos, así que
 * esconder la mitad del catálogo solo serviría para que nadie pase de la
 * primera fila.
 *
 * El elegido lleva la pastilla `--accent` y el trazo en `--primary`, el mismo
 * lenguaje con el que la sidebar marca el destino activo. El borde se enciende
 * además: entre treinta celdas iguales, el relleno solo no se distingue.
 *
 * Es un grupo de radio porque elegir un icono es elegir UNO entre varios. Y
 * como lo es, tiene que comportarse como uno: una sola parada de tabulador —la
 * celda marcada— y las flechas para moverse dentro. Ponerle los roles y dejar
 * treinta paradas de tabulador sería anunciar algo que no se cumple, que para
 * quien navega con teclado es peor que no anunciarlo.
 */
export function IconPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ProjectIconKey;
  onChange: (icon: ProjectIconKey) => void;
  disabled?: boolean;
}) {
  const grid = useRef<HTMLDivElement>(null);

  function move(event: React.KeyboardEvent, index: number) {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();

    // Cuántas columnas hay AHORA. Se mide en vez de suponerse porque la rejilla
    // cambia de 5 a 10 en `sm`, y una flecha que baje cinco celdas en
    // escritorio saltaría media rejilla.
    const width = grid.current?.clientWidth ?? 0;
    const columns = width > 0 && width >= 420 ? COLUMNS.desktop : COLUMNS.phone;

    // Da la vuelta por los extremos: en una rejilla cerrada de treinta, toparse
    // con un muro no aporta nada.
    const total = PROJECT_ICON_KEYS.length;
    const next = (index + step(columns) + total) % total;

    const key = PROJECT_ICON_KEYS[next];
    onChange(key);
    grid.current?.querySelector<HTMLElement>(`[data-icon="${key}"]`)?.focus();
  }

  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="flex items-baseline gap-2 p-0">
        <span className={LABEL_CLASS}>{PROJECTS_COPY.iconField}</span>
        <span className="text-[11px] text-primary">{projectIconLabel(value)}</span>
      </legend>
      <div
        ref={grid}
        role="radiogroup"
        aria-label={PROJECTS_COPY.iconField}
        className="grid grid-cols-5 gap-2 sm:grid-cols-10"
      >
        {PROJECT_ICON_KEYS.map((key, index) => {
          const Icon = projectIconFor(key);
          const selected = key === value;
          return (
            <button
              key={key}
              data-icon={key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={projectIconLabel(key)}
              title={projectIconLabel(key)}
              // Tabulador itinerante: solo la marcada es una parada. Sin esto,
              // pasar de largo el selector cuesta treinta pulsaciones.
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(key)}
              onKeyDown={(event) => move(event, index)}
              className={`flex h-13 items-center justify-center rounded-2xl border transition-colors disabled:opacity-45 sm:h-11 ${
                selected
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              <Icon width={20} height={20} />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
