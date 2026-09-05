"use client";

import { useEffect, useRef } from "react";

import { AnalysisHistory } from "@/components/analysis/analysis-history";
import { AnalysisResult } from "@/components/analysis/analysis-result";
import { useAnalysis } from "@/components/analysis/analysis-provider";
import { AnalysisToast } from "@/components/analysis/analysis-toast";
import { masterExport } from "@/components/analysis/export";
import { analysisWhen } from "@/components/analysis/history";
import { retryPlan } from "@/components/analysis/panel";
import { PromptActions } from "@/components/analysis/prompt-actions";
import { useElapsedSeconds } from "@/components/analysis/use-elapsed";
import { useWide } from "@/components/analysis/use-wide";
import { useBlocked } from "@/components/connection/connection-provider";
import { AnalysesIcon } from "@/components/icons/analyses-icon";
import { ChevronLeftIcon } from "@/components/icons/chevron-left-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import { HistoryIcon } from "@/components/icons/history-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  ICON_BUTTON_CLASS,
  LABEL_CLASS,
  PILL_CLASS,
  PILL_PRIMARY_CLASS,
} from "@/components/layout/site-chrome";
import { fire } from "@/components/tree/fire";
import { useTree } from "@/components/tree/tree-provider";
import { ErrorCard } from "@/components/ui/error-card";
import { ANALYSIS_COPY } from "@/lib/constants";
import {
  ANALYSIS_INPUT_LIMITS,
  hasSomethingToAnalyze,
} from "@/lib/services/analyses";


/**
 * El Panel de IA: dónde se escriben las Directrices y dónde se lee el Análisis.
 *
 * ── Por qué es una capa y no una tercera vista ────────────────────────────
 *
 * «Editar el árbol mientras genera: cero bloqueos» es un criterio de
 * aceptación, y una vista que SUSTITUYE al árbol lo incumple visualmente
 * aunque el estado sea independiente: para escribir un Nodo habría que salir
 * del panel. Así que el panel se pone ENCIMA en el teléfono y AL LADO en
 * escritorio, y en ninguno de los dos casos hay velo — un velo es lo que
 * convierte una capa en un diálogo, y un diálogo es exactamente lo que este
 * ticket promete no montar.
 *
 * Cerrarlo tampoco cancela nada: el estado vive en `AnalysisProvider`, que la
 * página monta por encima de esto. Lo que estaba en vuelo aterriza igual y lo
 * cuenta la puerta de la cabecera.
 */
/**
 * Cuánto ocupa el panel acoplado. Un número y no dos literales sueltos porque
 * `TreeScreen` tiene que apartarse EXACTAMENTE lo mismo: escrito a mano en los
 * dos sitios, el día que cambie uno el panel se solapa con el árbol y nada
 * falla — solo se lee mal.
 */
export const DOCKED_WIDTH = 440;

export function AnalysisLayer() {
  const { open, closePanel } = useAnalysis();
  const wide = useWide();

  // El teclado del teléfono, la tecla de escape y el botón de atrás son las
  // tres formas de «quitar esto de delante» en un móvil. La primera no aplica,
  // la tercera es del navegador, y ésta es la que falta.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      // Con un diálogo delante, Escape es SUYO. Los dos escuchan en
      // `document`, así que sin esto una sola pulsación disparaba los dos:
      // cancelaba el borrado y además cerraba el Panel de IA entero, dejando a
      // quien solo quería echarse atrás mirando el árbol.
      //
      // Se mira el DOM y no un estado compartido porque el diálogo puede
      // nacer de cualquier sitio de dentro del panel —hoy el Historial, mañana
      // otro— y un contador de diálogos abiertos obligaría a que todos se
      // acordaran de apuntarse. `aria-modal` ya lo declara quien lo abre.
      // Y no sirve `stopPropagation`: dos escuchas del mismo nodo no se
      // detienen entre sí, las ordena quien se registró antes.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  // Acoplado: una columna fija pegada al borde derecho, a toda altura. La
  // pantalla del árbol le hace sitio con su propio relleno — ver `TreeScreen`.
  // El aviso va abajo a la izquierda, fuera de la columna del panel.
  if (wide) {
    return (
      <>
        {open ? (
          <aside
            aria-label={ANALYSIS_COPY.label}
            style={{ width: DOCKED_WIDTH }}
            className="fixed inset-y-0 right-0 z-40 flex flex-col border-l border-border bg-card"
          >
            <PanelBody />
          </aside>
        ) : null}
        <AnalysisToast className="fixed bottom-6 left-6 z-50 max-w-[420px]" />
      </>
    );
  }

  // En móvil, aviso y hoja se APILAN por abajo, que es donde los pone el
  // boceto: el aviso flota justo encima del borde superior de la hoja. Una pila
  // y no dos capas fijas independientes porque la hoja crece con su contenido,
  // así que «encima de la hoja» no es un número que se pueda escribir a mano.
  //
  // La pila no intercepta el dedo (`pointer-events-none`); sus hijos sí. Sin
  // eso, un contenedor a todo lo ancho del pie se comería los toques del árbol
  // aunque estuviera vacío — y el árbol tiene que seguir siendo tocable, que es
  // el criterio entero de este ticket.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col justify-end">
      <AnalysisToast className="pointer-events-auto mx-4 mb-3" />
      {open ? (
        <aside
          aria-label={ANALYSIS_COPY.label}
          className="pointer-events-auto flex max-h-[85svh] flex-col rounded-t-[24px] border-t border-border bg-card shadow-popover"
        >
          <span
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-border"
          />
          <PanelBody />
        </aside>
      ) : null}
    </div>
  );
}

/**
 * Lo de dentro, igual en los dos formatos.
 *
 * Cabecera y pie anclados, y solo el medio se desplaza: el pie lleva las
 * Directrices, que es la palanca a la que apunta «Corregir con Directrices»
 * desde arriba del Análisis. Si se fuera con el desplazamiento, esa corrección
 * quedaría a varias pantallas del sitio donde se descubre que hace falta.
 */
function PanelBody() {
  const { view, status } = useAnalysis();
  // El pie desaparece con la lista delante: «Regenerar» sobre un Historial es
  // una acción sobre la Versión y no sobre lo que se está mirando, y ofrecerla
  // ahí invita a generar creyendo que se recarga la lista.
  //
  // SALVO mientras genera. Con el pie fuera, el Historial era el único sitio
  // del panel donde una generación en vuelo no se veía por ningún lado —el
  // cuerpo enseña la lista guardada, no la silueta— y el Análisis aterrizaba
  // de golpe, arrastrando la vista de vuelta sin que nada lo hubiera
  // anunciado. El botón deshabilitado diciendo «Generando…» es ese aviso.
  const footer = view !== "history" || status === "generating";

  return (
    <>
      <PanelHeader />
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <PanelContent />
      </div>
      {footer ? <GuidelinesFooter /> : null}
    </>
  );
}

/**
 * La cabecera: quién escribió lo que se está leyendo, la puerta al Historial y
 * la exportación del Master Prompt.
 *
 * ── Por qué la puerta va AQUÍ ─────────────────────────────────────────────
 *
 * Porque el Historial es navegación del panel, no contenido del Análisis: es
 * el otro lado de la misma hoja. Puesto dentro del desplazamiento sería una
 * sección más entre el Spec y los Tickets, y habría que buscarlo. Al lado de
 * cerrar, es lo que es — y «Volver» ocupa exactamente su sitio cuando la lista
 * está delante, así que ir y venir es pulsar dos veces en el mismo punto.
 *
 * ── Por qué la exportación del Master está ANCLADA ────────────────────────
 *
 * El Master Prompt es el Análisis ENTERO, así que su exportación no puede
 * depender de dónde estés en una lista de nueve Tickets. Anclada arriba está a
 * un toque siempre. Y va en la cabecera y no en el cuerpo por una razón que es
 * un criterio de aceptación de #16: lo primero que se LEE del contenido tiene
 * que seguir siendo la Intención, y una barra de acciones por delante la
 * empujaría fuera de la vista.
 */
function PanelHeader() {
  const { analysis, closePanel, view, analyses, now, openHistory, closeHistory } =
    useAnalysis();
  const history = view === "history";
  const when = analysis ? analysisWhen(analysis, now) : null;

  return (
    <div className="flex shrink-0 flex-col gap-3.5 px-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
            <span className={LABEL_CLASS}>
              {history ? ANALYSIS_COPY.history : ANALYSIS_COPY.label}
            </span>
          </p>
          {history ? (
            <p className="truncate text-[11px] text-muted-foreground">
              {ANALYSIS_COPY.historyMeta(analyses.length)}
            </p>
          ) : analysis ? (
            // Qué modelo lo escribió NO es diagnóstico opcional: el adaptador
            // tiene cadena de reserva, así que un Análisis flojo se explica
            // sabiendo que lo sirvió un plan B. La fecha se sumó con el
            // Historial: con varios Análisis guardados, «cuál estoy leyendo»
            // pasó a ser una pregunta.
            <p className="truncate text-[11px] text-muted-foreground">
              {ANALYSIS_COPY.provenance(analysis.model, when)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {history ? (
            <button
              type="button"
              onClick={closeHistory}
              className={PILL_PRIMARY_CLASS}
            >
              <ChevronLeftIcon width={14} height={14} />
              {ANALYSIS_COPY.historyBack}
            </button>
          ) : analyses.length > 0 ? (
            // Sin Análisis no hay puerta: una lista vacía no tiene nada que
            // enseñar, y un botón que abre la nada solo se pulsa una vez.
            <button
              type="button"
              onClick={openHistory}
              aria-label={ANALYSIS_COPY.historyOpen(analyses.length)}
              className={`${PILL_CLASS} border-border text-muted-foreground`}
            >
              <HistoryIcon width={15} height={15} />
              {analyses.length}
            </button>
          ) : null}

          <button
            type="button"
            onClick={closePanel}
            aria-label={ANALYSIS_COPY.closePanel}
            className={ICON_BUTTON_CLASS}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
      </div>

      {/* La línea siempre está: separa la cabecera anclada de lo que se
          desplaza. Lo que cambia es si lleva la barra encima. */}
      {!history && analysis ? (
        <div className="flex items-center justify-between gap-2.5 border-t border-border pt-3 pb-3.5">
          <span className={LABEL_CLASS}>{ANALYSIS_COPY.masterPrompt}</span>
          <PromptActions
            build={() => masterExport(analysis)}
            copyLabel={ANALYSIS_COPY.copyMaster}
            downloadLabel={ANALYSIS_COPY.downloadMaster}
          />
        </div>
      ) : (
        <div className="border-t border-border pb-3.5" />
      )}
    </div>
  );
}

/** Los cuatro estados del panel, explícitos. Es un criterio del ticket. */
function PanelContent() {
  const { status, analysis, loadError, reload, view } = useAnalysis();
  const tree = useTree();

  // El Historial se pinta ANTES de mirar `status`, y a propósito: la lista ya
  // está en memoria, así que enseñarla no depende de que haya terminado una
  // lectura ni de que la generación en curso llegue. Con la comprobación
  // debajo, abrir la lista durante una generación enseñaría la silueta de un
  // Análisis en camino en vez de los que ya hay guardados.
  if (view === "history") return <AnalysisHistory />;

  if (status === "error") {
    return (
      <ErrorCard
        title={ANALYSIS_COPY.loadErrorTitle}
        body={loadError ?? ANALYSIS_COPY.loadErrorBody}
      >
        <button
          type="button"
          onClick={() => fire(reload())}
          className={`${CTA_SECONDARY_CLASS} mt-1 px-8`}
        >
          {ANALYSIS_COPY.retry}
        </button>
      </ErrorCard>
    );
  }

  if (status === "loading") return <ResultSkeleton />;

  if (status === "generating") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <h2 className="text-[22px] font-bold tracking-[0.01em]">
            {ANALYSIS_COPY.generatingTitle}
          </h2>
          <p className="text-xs text-muted-foreground">
            {ANALYSIS_COPY.generatingMeta(tree.nodes.length)}
          </p>
        </div>

        <ResultSkeleton />

        <p className="text-center text-[11px] leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.generatingHint}
        </p>
      </div>
    );
  }

  if (analysis) {
    return (
      <div className="flex flex-col gap-6">
        <PastNotice />
        <AnalysisResult analysis={analysis} />
      </div>
    );
  }

  // Vacío: esta Versión no se ha analizado nunca. Lo que hay que hacer está en
  // el pie, así que aquí solo se dice dónde se está.
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-[22px] font-bold tracking-[0.01em]">
        {ANALYSIS_COPY.emptyTitle}
      </h2>
      <p className="text-xs text-muted-foreground">
        {ANALYSIS_COPY.emptyMeta(tree.nodes.length)}
      </p>
    </div>
  );
}

/**
 * El aviso de que lo que se está leyendo NO es el vigente.
 *
 * Es lo único en todo el panel que se pone por delante de la Intención, y se
 * lo gana: cambia el significado de todo lo que hay debajo. Un Spec de
 * anteayer leído como si fuera el de hoy manda a implementar lo que ya se
 * descartó, y descubrirlo al final es haber leído el panel entero para nada.
 *
 * Lleva las dos salidas dentro —volver al vigente, o volver a la lista— porque
 * un aviso que dice «esto es antiguo» sin decir dónde está lo nuevo obliga a
 * buscarlo.
 */
function PastNotice() {
  const { past, current, now, goToCurrent, openHistory } = useAnalysis();
  if (!past || !current) return null;

  const when = analysisWhen(current, now);

  return (
    <div className="flex gap-3 rounded-[20px] border border-border bg-accent p-4">
      <HistoryIcon width={18} height={18} className="mt-px shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="text-[13px] leading-relaxed text-pretty">
          {ANALYSIS_COPY.past(when)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToCurrent}
            className={`${PILL_PRIMARY_CLASS} h-8 px-3.5`}
          >
            {ANALYSIS_COPY.pastGoToCurrent}
          </button>
          <button
            type="button"
            onClick={openHistory}
            className={`${PILL_CLASS} h-8 border-border px-3.5 text-muted-foreground`}
          >
            {ANALYSIS_COPY.history}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * La silueta de un Análisis en camino. Dice la forma que va a quedar, y empieza
 * por el bloque de la Intención: lo primero que aparece es lo primero que se
 * lee, tanto al leer del motor como al generar.
 */
function ResultSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={ANALYSIS_COPY.loading}
      className="flex flex-col gap-3"
    >
      <Bar className="w-24" />
      <Bar className="h-8 w-40" />
      <Bar className="w-full" />
      <Bar className="w-4/5" />
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <span className={`h-3 rounded-md bg-accent ${className}`} />;
}

/**
 * Las Directrices y el botón que genera, anclados al pie.
 *
 * Se PLIEGAN cuando ya hay un Análisis: con resultado en pantalla lo que manda
 * es el resultado —la Intención arriba del todo— y el campo entero la empujaría
 * fuera de la vista. Plegado sigue diciendo qué se mandó, que es lo que hace
 * falta para decidir si hay que cambiarlo.
 *
 * Plegado y foco viven en el PROVIDER y no aquí, y esa es la corrección de un
 * fallo real: «Corregir con Directrices», arriba del Análisis, era un ancla a
 * `#directrices`. El pie ya estaba visible —está anclado, no se desplaza— y
 * estaba plegado, así que pulsar el enlace no producía ningún efecto
 * observable, justo en el caso para el que el ADR 0003 lo pide.
 */
function GuidelinesFooter() {
  const {
    guidelines,
    setGuidelines,
    guidelinesOpen,
    guidelinesFocus,
    toggleGuidelines,
    generate,
    status,
    failure,
    failedAt,
    analysis,
    past,
  } = useAnalysis();
  const field = useRef<HTMLTextAreaElement>(null);
  const tree = useTree();
  const blocked = useBlocked();

  // Desplegar sin llevar el cursor dejaría a quien pulsó «Corregir» mirando un
  // campo abierto y teniendo que tocarlo otra vez para escribir.
  useEffect(() => {
    if (guidelinesFocus > 0 && guidelinesOpen) field.current?.focus();
  }, [guidelinesFocus, guidelinesOpen]);

  const elapsed = useElapsedSeconds(failedAt);
  const plan = failure ? retryPlan(failure, elapsed) : null;
  const generating = status === "generating";
  // Solo la espera de la cuota bloquea por fallo. Uno que no se puede
  // reintentar tampoco lo bloquea: cambiar las Directrices y volver a probar es
  // legítimo, y es justo lo que hay que hacer tras un `entrada`.
  const waiting = plan?.kind === "espera";
  // Y una Versión en la que nadie ha escrito nada no se manda: el servicio lo
  // rechaza igual, pero enterarse ANTES de pulsar es la diferencia entre un
  // botón apagado y un fallo. La regla sale del servicio, no se reescribe aquí.
  const empty = !hasSomethingToAnalyze(tree.nodes);
  // Sin red tampoco. Generar gasta cuota y PERSISTE el Análisis, así que es
  // una mutación como cualquier otra. Lo que NO se apaga son las Directrices:
  // viven en la pantalla hasta que se generan (no hay Autoguardado detrás), y
  // escribirlas mientras vuelve la conexión es justo lo que se puede hacer.
  const disabled = generating || waiting || empty || blocked;

  const label = generating
    ? ANALYSIS_COPY.generating
    : waiting
      ? ANALYSIS_COPY.retryIn(plan.seconds)
      : analysis
        ? ANALYSIS_COPY.regenerate
        : ANALYSIS_COPY.generate;

  const action = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => fire(generate())}
      className={`${CTA_PRIMARY_CLASS} px-6 disabled:bg-accent disabled:text-muted-foreground`}
    >
      {generating ? (
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
      ) : (
        <AnalysesIcon width={18} height={18} />
      )}
      {label}
    </button>
  );

  if (!guidelinesOpen) {
    return (
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-border px-6 pt-3.5 pb-5">
        {past ? (
          <p className="text-[11px] leading-relaxed text-pretty text-muted-foreground">
            {ANALYSIS_COPY.pastRegenerate}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleGuidelines}
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
        >
          <span className={LABEL_CLASS}>{ANALYSIS_COPY.guidelinesField}</span>
          <span className="w-full truncate text-xs text-muted-foreground">
            {guidelines.trim() || ANALYSIS_COPY.guidelinesPlaceholder}
          </span>
        </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => fire(generate())}
            className={`${PILL_PRIMARY_CLASS} h-10 disabled:border-border disabled:text-muted-foreground`}
          >
            {label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col gap-4 border-t border-border px-6 pt-4 pb-6">
      <div className="flex flex-col gap-2">
        <label className={LABEL_CLASS} htmlFor="analysis-guidelines">
          {generating
            ? ANALYSIS_COPY.guidelinesSent
            : ANALYSIS_COPY.guidelinesField}
        </label>
        <textarea
          ref={field}
          id="analysis-guidelines"
          rows={3}
          value={guidelines}
          onChange={(event) => setGuidelines(event.target.value)}
          // Mientras la petición está en vuelo lo escrito ya salió, y teclear
          // más no la alcanza. Se congela, no se borra.
          disabled={generating}
          maxLength={ANALYSIS_INPUT_LIMITS.guidelinesMax}
          placeholder={ANALYSIS_COPY.guidelinesPlaceholder}
          className="resize-none rounded-2xl border border-border bg-card px-4.5 py-4 text-[15px] leading-relaxed text-foreground transition-colors outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-45"
        />
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 text-[11px] leading-relaxed text-pretty text-muted-foreground">
            {ANALYSIS_COPY.guidelinesHint}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {ANALYSIS_COPY.guidelinesCount(
              guidelines.length,
              ANALYSIS_INPUT_LIMITS.guidelinesMax,
            )}
          </span>
        </div>
      </div>

      {action}

      {/* La última línea de la hoja, bajo el botón. Con un Análisis pasado
          delante dice lo que va a pasar —nace uno nuevo, éste se queda—; sin
          ningún Análisis, los dos datos que la gente pregunta antes de pulsar:
          cuánto tarda y si puede irse. Con el vigente delante no hace falta
          ninguna de las dos. */}
      {past ? (
        <p className="text-center text-[11px] leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.pastRegenerate}
        </p>
      ) : analysis ? null : (
        <p className="text-center text-[11px] leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.generateHint}
        </p>
      )}
    </div>
  );
}
