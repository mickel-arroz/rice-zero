import { LABEL_CLASS } from "@/components/layout/site-chrome";
import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * Los Checks de un Spec o de un Ticket: casillas que nadie puede marcar aquí.
 *
 * Un componente y no dos porque el Spec y los Tickets llevan exactamente la
 * misma lista, y la única forma de que dentro de un mes no se pinten distinto
 * es que sea el mismo componente.
 *
 * Deshabilitadas a propósito, y la línea de al lado lo explica: son la prueba
 * que tiene que cumplir el agente al que se le pegue el Master Prompt (#17), no
 * un TODO list de esta app. El Análisis, además, es histórico —se crea, se lee
 * y se borra, pero no se edita (`ports/entities.ts`)—, así que un Check marcado
 * aquí no tendría dónde guardarse. Por eso el schema los define como texto y no
 * como `{ id, text, done }`.
 *
 * `<input type="checkbox" disabled>` de verdad y no un cuadrado dibujado: un
 * lector de pantalla tiene que oír «casilla, no marcada, deshabilitada», que es
 * la mitad de la explicación para quien no ve el gris.
 */
export function Checks({ checks }: { checks: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className={LABEL_CLASS}>{ANALYSIS_COPY.checks}</span>
        <span className="text-[10px] text-muted-foreground">
          {ANALYSIS_COPY.checksWhy}
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {checks.map((check, index) => (
          <li key={index} className="flex gap-2.5">
            <input
              type="checkbox"
              disabled
              // `appearance-none` para poder pintarla con los tokens del tema:
              // la casilla nativa trae el azul del sistema, que es el único
              // color que esta app no usa en ningún sitio.
              className="mt-[3px] size-[15px] shrink-0 cursor-not-allowed appearance-none rounded border border-edge opacity-75"
            />
            <span className="text-[13px] leading-relaxed text-pretty">{check}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
