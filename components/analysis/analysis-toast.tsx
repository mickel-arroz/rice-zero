"use client";

import Link from "next/link";

import { useAnalysis } from "@/components/analysis/analysis-provider";
import { retryPlan } from "@/components/analysis/panel";
import { useElapsedSeconds } from "@/components/analysis/use-elapsed";
import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import { CloseIcon } from "@/components/icons/close-icon";
import {
  ICON_BUTTON_CLASS,
  PILL_PRIMARY_CLASS,
} from "@/components/layout/site-chrome";
import { fire } from "@/components/tree/fire";
import { ANALYSIS_COPY, ROUTES } from "@/lib/constants";

/**
 * El aviso de que la generación falló.
 *
 * ── Por qué flota FUERA del panel ─────────────────────────────────────────
 *
 * Porque la hoja puede estar cerrada. Generar no bloquea nada, así que lo
 * normal es lanzar el Análisis y volver al árbol — y si el fallo viviera dentro
 * del panel, un 429 a los treinta segundos no lo vería nadie: la puerta seguiría
 * diciendo «Generando» hasta que a alguien se le ocurriera abrirla.
 *
 * ── Qué botón sale, y cuándo ──────────────────────────────────────────────
 *
 * Lo decide `retryPlan`, y ahí está la única sutileza de este archivo. El
 * ticket pide «toast + reintento» para el 429 y la taxonomía marca la cuota
 * como no reintentable; las dos cosas son ciertas porque `retryable: false`
 * significa «no AHORA». El botón, entonces, cuenta hacia atrás con el plazo que
 * dio el proveedor y se enciende solo. Cuando el proveedor no dice cuánto, no
 * hay botón: uno que no sabe si va a funcionar invita a gastar cuota a ciegas.
 *
 * `sesion` es el único caso con salida propia: lo que hace falta no es
 * insistir, es entrar.
 */
export function AnalysisToast({ className }: { className: string }) {
  const { failure, failedAt, dismissFailure, generate, status } = useAnalysis();
  const blocked = useBlocked();
  const elapsed = useElapsedSeconds(failedAt);

  // Empezar de nuevo ya dice todo lo que este aviso tenía que decir.
  if (!failure || status === "generating") return null;

  const plan = retryPlan(failure, elapsed);

  return (
    <div
      role="alert"
      // DÓNDE lo decide quien lo monta: en móvil se apila justo encima de la
      // hoja, en escritorio va abajo a la izquierda, fuera de la columna del
      // panel. La forma —tarjeta con sombra de popover— es la misma en los dos.
      className={`flex gap-3 rounded-[20px] border border-border bg-card p-4 shadow-popover ${className}`}
    >
      <AlertIcon width={20} height={20} className="mt-px shrink-0 text-primary" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-[13px] leading-snug font-bold text-pretty">
          {ANALYSIS_COPY.failures[failure.kind]}
        </p>
        {/* El cuerpo lo escribió la clase que falló: ya viene en español y ya
            dice lo concreto —cuántos segundos, qué variable falta—. Reescribirlo
            aquí sería tener el mismo mensaje en dos sitios. */}
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          {failure.message}
        </p>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          {ANALYSIS_COPY.failureKept}
        </p>

        {failure.kind === "sesion" ? (
          <Link
            href={ROUTES.login}
            className={`${PILL_PRIMARY_CLASS} mt-0.5 self-start`}
          >
            {ANALYSIS_COPY.goToLogin}
          </Link>
        ) : plan.kind === "nunca" ? null : (
          <button
            type="button"
            // Sin red se apaga: `generate` ya no manda nada, así que un botón
            // vivo dejaría el aviso igual sin decir por qué. El texto lo
            // explica la franja de arriba.
            disabled={plan.kind === "espera" || blocked}
            onClick={() => fire(generate())}
            className={`${PILL_PRIMARY_CLASS} mt-0.5 self-start disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground`}
          >
            {plan.kind === "espera"
              ? ANALYSIS_COPY.retryIn(plan.seconds)
              : ANALYSIS_COPY.retry}
          </button>
        )}

        {failure.kind === "cuota" ? (
          <p className="text-[11px] leading-relaxed text-pretty text-muted-foreground">
            {ANALYSIS_COPY.quotaHint}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={dismissFailure}
        aria-label={ANALYSIS_COPY.dismiss}
        className={ICON_BUTTON_CLASS}
      >
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  );
}
