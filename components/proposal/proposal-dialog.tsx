"use client";

import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { generateProposal } from "@/app/(dashboard)/projects/[projectId]/[versionId]/actions";
import { useBlocked } from "@/components/connection/connection-provider";
import { AlertIcon } from "@/components/icons/alert-icon";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
  LABEL_CLASS,
} from "@/components/layout/site-chrome";
import { Field } from "@/components/projects/field";
import { INDENT } from "@/components/registro/node-row";
import { RowSkeleton } from "@/components/registro/registro-view";
import { useTree } from "@/components/tree/tree-provider";
import { PartialProposalError } from "@/lib/tree/proposal";
import { Dialog } from "@/components/ui/dialog";

import {
  countProposalNodes,
  PROPOSAL_LIMITS,
  type Proposal,
} from "@/lib/ai/proposal";
import { CONNECTION_COPY, PROPOSAL_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import {
  PROPOSAL_INPUT_LIMITS,
  proposalService,
} from "@/lib/services/proposals";

/**
 * El diálogo de la Propuesta de Nodos: pedir, esperar, mirar y añadir.
 *
 * Ver el boceto aprobado en #67. Tres fases y no tres diálogos, porque es UNA
 * conversación: lo que se pidió sigue arriba mientras se espera y mientras se
 * mira, y es lo que «Regenerar» vuelve a mandar.
 *
 * La Propuesta vive SOLO en el estado de este componente. Cerrar el diálogo es
 * descartarla —no hay botón aparte, no hay nada que confirmar— y eso es lo que
 * hace verdad que «no se persiste»: no hay ningún sitio más donde quede.
 */

type Phase =
  | { kind: "asking"; error: string | null }
  | { kind: "loading" }
  | {
      kind: "preview";
      proposal: Proposal;
      model: string;
      error: string | null;
      /**
       * «Añadir» se cortó a medias: parte ya está en el árbol, así que no se
       * puede volver a añadir sin duplicarla. Ver `PartialProposalError`.
       */
      spent: boolean;
    };

type PreviewPhase = Extract<Phase, { kind: "preview" }>;

/** Una fila de la vista previa: el texto y a qué hondura va. */
type PreviewRow = { key: string; depth: number; text: string };

/**
 * La Propuesta aplanada para pintarla.
 *
 * No reutiliza `proposalCreations` a propósito: aquella es el plan de
 * ESCRITURAS y sus claves son un detalle suyo. Deducir la hondura de ellas
 * ataría la pantalla a cómo se nombran los pasos.
 */
function previewRows(proposal: Proposal): PreviewRow[] {
  return proposal.roots.flatMap((root, r) => [
    { key: `${r}`, depth: 0, text: root.text },
    ...root.children.flatMap((child, c) => [
      { key: `${r}.${c}`, depth: 1, text: child.text },
      ...child.children.map((leaf, l) => ({
        key: `${r}.${c}.${l}`,
        depth: 2,
        text: leaf.text,
      })),
    ]),
  ]);
}

/** La hondura de cada silueta mientras la IA escribe. Con la forma de un árbol. */
const SKELETON_DEPTHS = [0, 1, 1, 0, 1, 2];

export function ProposalDialog({ onClose }: { onClose: () => void }) {
  const tree = useTree();
  const blocked = useBlocked();
  // De la URL, igual que la puerta del Análisis: la Versión no baja hasta aquí.
  const { versionId } = useParams<{ versionId: string }>();
  const service = useMemo(() => proposalService(generateProposal), []);

  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "asking", error: null });
  const [appending, setAppending] = useState(false);

  /**
   * Qué petición es la vigente.
   *
   * Una petición tarda segundos, y en ese rato se puede cerrar el diálogo o
   * volver a pedir. La respuesta de una petición que ya no es la vigente se
   * tira: si no, una Propuesta vieja podría pintarse encima de la nueva.
   */
  const ticket = useRef(0);

  async function propose() {
    if (request.trim().length === 0 || blocked) return;

    // Si se está regenerando, la Propuesta de antes se guarda para devolverla
    // si esta petición falla: perder la vista previa por un fallo de red no es
    // descartarla, y descartar es cosa de quien mira.
    const previous = phase.kind === "preview" ? phase : null;
    const mine = ++ticket.current;
    setPhase({ kind: "loading" });
    try {
      const { proposal, model } = await service.propose({ versionId, request });
      if (mine !== ticket.current) return;
      setPhase({ kind: "preview", proposal, model, error: null, spent: false });
    } catch (cause) {
      if (mine !== ticket.current) return;
      // Sin vista previa que devolver, a la fase de pedir con lo escrito
      // intacto: reintentar es volver a pulsar, sin teclear nada otra vez.
      setPhase(
        previous
          ? { ...previous, error: errorMessage(cause) }
          : { kind: "asking", error: errorMessage(cause) },
      );
    }
  }

  async function append(preview: PreviewPhase) {
    setAppending(true);
    try {
      await tree.appendProposal(preview.proposal);
      onClose();
    } catch (cause) {
      // Se queda abierto con la Propuesta delante. Si no entró nada se puede
      // volver a añadir; si entró parte, no. El fallo lo cuenta también el pie
      // de la cabecera.
      setPhase({
        ...preview,
        error: errorMessage(cause),
        spent: preview.spent || cause instanceof PartialProposalError,
      });
      setAppending(false);
    }
  }

  function close() {
    // Mientras se añade, cerrar no descartaría nada: las escrituras siguen
    // saliendo. Se espera a que terminen.
    if (appending) return;
    // Cualquier respuesta que siga en camino ya no tiene a quién pintarse.
    ticket.current += 1;
    onClose();
  }

  const asking = phase.kind === "asking";

  return (
    <Dialog
      label={PROPOSAL_COPY.label}
      title={PROPOSAL_COPY.title}
      onClose={close}
      closeLabel={
        phase.kind === "preview" ? PROPOSAL_COPY.discard : PROPOSAL_COPY.close
      }
    >
      {asking ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void propose();
          }}
          className="flex flex-1 flex-col gap-5"
        >
          <Field
            label={PROPOSAL_COPY.requestField}
            value={request}
            onChange={setRequest}
            placeholder={PROPOSAL_COPY.requestPlaceholder}
            maxLength={PROPOSAL_INPUT_LIMITS.requestMax}
            rows={4}
            autoFocus
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {PROPOSAL_COPY.hint(PROPOSAL_LIMITS.roots)}
          </p>
          {phase.error ? <InlineError message={phase.error} /> : null}
          <button
            type="submit"
            disabled={request.trim().length === 0 || blocked}
            title={blocked ? CONNECTION_COPY.blocked : undefined}
            className={`${CTA_PRIMARY_CLASS} mt-auto disabled:opacity-45`}
          >
            {PROPOSAL_COPY.submit}
          </button>
        </form>
      ) : (
        <>
          {/* Lo que se pidió, congelado: es lo que «Regenerar» vuelve a mandar. */}
          <p className="rounded-2xl border border-border bg-background px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
            «{request.trim()}»
          </p>

          {phase.kind === "loading" ? (
            <>
              <ul
                aria-busy="true"
                aria-label={PROPOSAL_COPY.loadingLabel}
                className="flex flex-col"
              >
                {/* Las MISMAS siluetas que el Registro mientras carga: lo que
                    llega va a ser filas de ese árbol. */}
                {SKELETON_DEPTHS.map((depth, index) => (
                  <RowSkeleton key={index} depth={depth} />
                ))}
              </ul>
              <button
                type="button"
                disabled
                className={`${CTA_PRIMARY_CLASS} mt-auto disabled:opacity-35`}
              >
                {PROPOSAL_COPY.loading}
              </button>
            </>
          ) : (
            <Preview
              preview={phase}
              busy={appending}
              blocked={blocked}
              onRegenerate={() => void propose()}
              onAppend={() => void append(phase)}
            />
          )}
        </>
      )}
    </Dialog>
  );
}

/**
 * La Propuesta, de solo lectura.
 *
 * Filas con su punto y su sangría —el mismo `INDENT` del Registro, para que se
 * lea como el árbol que va a ser—, pero con el borde PUNTEADO y sin casilla ni
 * campo: todavía no existen, y nada de aquí se puede tocar. La Propuesta se
 * añade entera, se regenera o se descarta.
 */
function Preview({
  preview: { proposal, model, error, spent },
  busy,
  blocked,
  onRegenerate,
  onAppend,
}: {
  preview: PreviewPhase;
  busy: boolean;
  blocked: boolean;
  onRegenerate: () => void;
  onAppend: () => void;
}) {
  const nodes = countProposalNodes(proposal);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className={LABEL_CLASS}>{PROPOSAL_COPY.preview}</span>
        <span className="text-right text-xs text-muted-foreground">
          {PROPOSAL_COPY.summary(proposal.roots.length, nodes)} · {model}
        </span>
      </div>

      <ul aria-label={PROPOSAL_COPY.previewLabel} className="flex flex-col">
        {previewRows(proposal).map((row) => (
          <li key={row.key} className="flex min-h-11 items-center">
            <span
              aria-hidden="true"
              className="flex shrink-0 justify-end pr-2"
              style={{ width: (row.depth + 1) * INDENT + 7 }}
            >
              <span
                className={`rounded-full ${row.depth === 0 ? "size-2 bg-foreground" : "size-1.5 bg-edge"}`}
              />
            </span>
            <span className="my-[3px] flex-1 rounded-[14px] border border-dashed border-border px-3.5 py-2.5 text-[13px] leading-normal break-words">
              {row.text}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {PROPOSAL_COPY.appendNote}
      </p>

      {error ? <InlineError message={error} /> : null}

      {/* En el teléfono «Añadir» va arriba, donde llega el pulgar; en
          escritorio, a la derecha, que es donde se lee la acción principal. */}
      <div className="mt-auto flex flex-col-reverse gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy || blocked}
          className={`${CTA_SECONDARY_CLASS} flex-1 disabled:opacity-45`}
        >
          {PROPOSAL_COPY.regenerate}
        </button>
        <button
          type="button"
          onClick={onAppend}
          disabled={busy || blocked || spent}
          title={blocked ? CONNECTION_COPY.blocked : undefined}
          className={`${CTA_PRIMARY_CLASS} flex-1 disabled:opacity-45`}
        >
          {busy ? PROPOSAL_COPY.appending : PROPOSAL_COPY.append(nodes)}
        </button>
      </div>
    </>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 text-[13px] leading-relaxed text-primary"
    >
      <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
