"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PromptExport } from "@/components/analysis/export";
import { copyText, downloadText } from "@/components/analysis/transfer";
import { AlertIcon } from "@/components/icons/alert-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import { CopyIcon } from "@/components/icons/copy-icon";
import { DownloadIcon } from "@/components/icons/download-icon";
import { PILL_CLASS } from "@/components/layout/site-chrome";
import { fire } from "@/components/tree/fire";
import { ANALYSIS_COPY } from "@/lib/constants";

/**
 * Copiar y descargar un prompt. El mismo par para el Master y para un Ticket.
 *
 * Un solo componente y no dos porque el gesto es idéntico y lo único que
 * cambia es QUÉ texto sale — y eso entra como una función. Dos copias de esta
 * pareja de pastillas divergirían en cuanto alguien tocara una, y son el
 * control que este ticket promete tener «para el Master Prompt y para cada
 * Ticket Prompt por separado».
 *
 * ── El texto se arma al PULSAR, no al pintar ──────────────────────────────
 *
 * Por eso `build` es una función y no un `string`. Renderizar el Master Prompt
 * recorre el Análisis entero —Spec, Tickets y Checks—, y pasarlo ya hecho lo
 * haría en cada repintado del panel: una vez por tecla escrita en las
 * Directrices, con nueve Tickets renderizándose de propina. Al pulsar, es una
 * vez y cuando hace falta.
 *
 * ── Esto no se apaga sin conexión ─────────────────────────────────────────
 *
 * A diferencia de todo lo demás que se pulsa en el panel. Copiar y descargar
 * no escriben en ningún sitio: el Análisis ya está en la pantalla y el
 * renderer es local. Apagarlas sin red quitaría justo lo que sí se puede hacer
 * en un tren. Ver `components/analysis/transfer.ts`.
 */

/** Lo último que pasó, para decirlo dentro de la propia pastilla. */
type Feedback = "idle" | "copied" | "downloaded" | "failed";

/**
 * Cuánto dura cada confirmación antes de apagarse sola.
 *
 * Dos segundos para lo que salió bien: menos no da tiempo a leerlo, y más
 * sigue ahí cuando ya estás copiando el Ticket siguiente — y una pastilla que
 * dice «Copiado» sobre un Ticket que todavía no has copiado miente.
 *
 * El doble para el fallo, y no es simetría rota sino la diferencia entre las
 * dos cosas: «Copiado» confirma algo que ya notaste al pulsar, y «No se copió»
 * pide una reacción —volver a intentarlo, o descargar el `.md` en su lugar—.
 * Es lo único de este componente que hay que llegar a leer.
 */
const FEEDBACK_MS: Record<Exclude<Feedback, "idle">, number> = {
  copied: 2_000,
  downloaded: 2_000,
  failed: 4_000,
};

/**
 * El estado transitorio de las pastillas: qué acaban de hacer, y hasta cuándo
 * lo dicen.
 *
 * La confirmación vive DENTRO del botón y no en un toast, y es una decisión de
 * este panel: un cartel flotante por copiar taparía el Ticket que se acaba de
 * copiar, que es justo lo que se estaba mirando. El precio es que hay que
 * decidir cuándo se apaga sola.
 */
function useFeedback(): {
  feedback: Feedback;
  show(next: Exclude<Feedback, "idle">): void;
} {
  const [feedback, setFeedback] = useState<Feedback>("idle");
  /** El temporizador en vuelo, si lo hay. Se cancela al pisarlo: ver `show`. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: Exclude<Feedback, "idle">) => {
    // El anterior se cancela antes de nada. Sin esto, copiar dos Tickets
    // seguidos deja el segundo «Copiado» colgando del reloj del primero, y
    // se apaga a la mitad de su tiempo — el caso raro sería que se viera
    // bien, no que se viera mal.
    if (timer.current) clearTimeout(timer.current);

    setFeedback(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      setFeedback("idle");
    }, FEEDBACK_MS[next]);
  }, []);

  // Un temporizador que dispara con la hoja ya cerrada no rompe nada, pero es
  // trabajo por nada: el componente se desmonta al cerrar el panel y al
  // cambiar de Análisis, que es justo cuando más se pulsa esto.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { feedback, show };
}

export function PromptActions({
  build,
  copyLabel,
  downloadLabel,
}: {
  /** Arma el texto y su nombre de archivo. Se llama al pulsar, no al pintar. */
  build: () => PromptExport;
  /** Qué lee un lector de pantalla en «Copiar». El botón solo dice el verbo. */
  copyLabel: string;
  downloadLabel: string;
}) {
  const { feedback, show } = useFeedback();

  async function copy() {
    try {
      await copyText(build().text);
      show("copied");
    } catch {
      // El navegador puede negarse: fuera de contexto seguro `clipboard` ni
      // existe, y con permiso denegado la promesa se rompe. Se dice, en vez de
      // dejar creer que el texto está en el portapapeles cuando no lo está.
      show("failed");
    }
  }

  function download() {
    const { filename, text } = build();
    downloadText(filename, text);
    show("downloaded");
  }

  const copied = feedback === "copied";
  const failed = feedback === "failed";
  const downloaded = feedback === "downloaded";

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        onClick={() => fire(copy())}
        aria-label={copyLabel}
        className={`${PILL_CLASS} ${
          copied
            ? "border-primary bg-primary text-primary-foreground"
            : failed
              ? "border-primary text-primary"
              : "border-border text-muted-foreground hover:border-primary hover:text-primary"
        }`}
      >
        {copied ? (
          <CheckIcon width={14} height={14} />
        ) : failed ? (
          <AlertIcon width={14} height={14} />
        ) : (
          <CopyIcon width={14} height={14} />
        )}
        {copied ? ANALYSIS_COPY.copied : failed ? ANALYSIS_COPY.copyFailed : ANALYSIS_COPY.copy}
      </button>

      <button
        type="button"
        onClick={download}
        aria-label={downloadLabel}
        className={`${PILL_CLASS} ${
          downloaded
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
        }`}
      >
        {downloaded ? (
          <CheckIcon width={14} height={14} />
        ) : (
          <DownloadIcon width={14} height={14} />
        )}
        {downloaded ? ANALYSIS_COPY.downloaded : ANALYSIS_COPY.download}
      </button>
    </div>
  );
}
