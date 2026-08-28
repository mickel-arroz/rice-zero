"use client";

import { useMemo, useState } from "react";

import { AlertIcon } from "@/components/icons/alert-icon";
import { BlockedIcon } from "@/components/icons/blocked-icon";
import { CheckIcon } from "@/components/icons/check-icon";
import { CircleIcon } from "@/components/icons/circle-icon";
import { useRegistro } from "@/components/registro/registro-provider";
import { Dialog } from "@/components/ui/dialog";
import {
  CTA_PRIMARY_CLASS,
  CTA_SECONDARY_CLASS,
} from "@/components/layout/site-chrome";
import type { TreeNode } from "@/lib/backend/ports";
import { REGISTRO_COPY } from "@/lib/constants";
import { errorMessage } from "@/lib/errors";
import { NODE_ERRORS } from "@/lib/services/nodes";
import { REPARENT_RULES, type ReparentRule } from "@/lib/tree/model";
import { reparentTargets, type ReparentTarget } from "@/lib/tree/rows";

/**
 * El selector de destino: re-parentar sin arrastrar nada.
 *
 * Enseña el árbol ENTERO, incluidos los destinos que no valen, apagados y con
 * el motivo escrito al lado. Filtrarlos habría sido más limpio de mirar y peor
 * de usar: quien busca «Autenticación» en la lista y no lo encuentra no deduce
 * «es un subnodo mío», deduce que la app se lo comió. Ver `reparentTargets`.
 */

/** La sangría de la lista de destinos. Menor que la del árbol: aquí solo orienta. */
const TARGET_INDENT = 18;

/** Por qué no vale este destino, en dos palabras y a la derecha de su fila. */
function blockedReason(target: ReparentTarget, nodeId: string): string | null {
  if (target.current) return REGISTRO_COPY.moveCurrent;
  if (target.rejection === null) return null;
  // El dominio devuelve `cycle` tanto para el propio Nodo como para los suyos:
  // para él es un ciclo de longitud cero. Son la misma regla y dos frases
  // distintas, y distinguirlas es una comparación de ids, no otra regla.
  if (target.rejection === REPARENT_RULES.cycle) {
    return target.node.id === nodeId
      ? REGISTRO_COPY.moveBlockedSelf
      : REGISTRO_COPY.moveBlockedDescendant;
  }
  return REGISTRO_COPY.moveBlockedGone;
}

function TargetRow({
  label,
  depth,
  picked,
  blocked,
  reason,
  onClick,
}: {
  label: string;
  depth: number;
  picked: boolean;
  blocked: boolean;
  reason: string | null;
  onClick: () => void;
}) {
  const Mark = blocked ? BlockedIcon : picked ? CheckIcon : CircleIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      // Los bloqueados NO llevan `disabled`: pulsarlos es lo que enseña el
      // porqué en el aviso de abajo, y un botón inerte no explica nada. Lo que
      // sí llevan es `aria-disabled`, que es la verdad para quien no ve el
      // gris.
      aria-disabled={blocked}
      aria-pressed={picked}
      className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-colors ${
        picked
          ? "border-primary bg-accent text-primary"
          : "border-transparent hover:border-border"
      } ${blocked || reason ? "opacity-45" : ""}`}
      style={{ paddingLeft: 14 + depth * TARGET_INDENT }}
    >
      <span className={`flex shrink-0 ${blocked ? "text-primary" : ""}`}>
        <Mark width={16} height={16} />
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${picked ? "font-bold" : ""}`}
      >
        {label}
      </span>
      {reason ? (
        <span className="shrink-0 text-[10px] tracking-[0.06em] whitespace-nowrap uppercase text-muted-foreground">
          {reason}
        </span>
      ) : null}
    </button>
  );
}

export function ReparentDialog({
  node,
  onClose,
}: {
  node: TreeNode;
  onClose: () => void;
}) {
  const { nodes, reparent, textOf } = useRegistro();
  const targets = useMemo(() => reparentTargets(nodes, node.id), [nodes, node.id]);

  /** El destino elegido. `undefined` es «todavía ninguno»; `null` es la raíz. */
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  /** El rechazo que el usuario acaba de intentar, para explicárselo. */
  const [rejected, setRejected] = useState<ReparentRule | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const title = REGISTRO_COPY.nodeLabel(textOf(node));
  const alreadyRoot = node.parentId === null;

  function pick(id: string | null, rejection: ReparentRule | null) {
    if (rejection) {
      setRejected(rejection);
      return;
    }
    setRejected(null);
    setPicked(id);
  }

  async function submit() {
    if (picked === undefined) return;
    setMoving(true);
    setFailure(null);
    try {
      await reparent(node.id, picked);
      onClose();
    } catch (error) {
      // El diálogo NO se cierra: el Nodo sigue donde estaba y cerrarlo dejaría
      // al usuario creyendo que se movió.
      setFailure(errorMessage(error));
      setMoving(false);
    }
  }

  return (
    <Dialog
      label={REGISTRO_COPY.moveLabel}
      title={title}
      onClose={onClose}
      closeLabel={REGISTRO_COPY.close}
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} className={CTA_SECONDARY_CLASS}>
            {REGISTRO_COPY.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={picked === undefined || moving}
            className={`${CTA_PRIMARY_CLASS} disabled:opacity-40`}
          >
            {REGISTRO_COPY.moveSubmit}
          </button>
        </div>
      }
    >
      <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
        {REGISTRO_COPY.moveLead}
      </p>

      <div className="-mx-2 flex flex-col gap-0.5">
        {/* La raíz siempre vale: una Versión admite varias raíces, y soltar un
            Nodo suelto es tan legítimo como colgarlo. */}
        <TargetRow
          label={REGISTRO_COPY.moveRoot}
          depth={0}
          picked={picked === null}
          blocked={false}
          reason={alreadyRoot ? REGISTRO_COPY.moveCurrent : null}
          onClick={() => pick(null, null)}
        />
        {targets.map((target) => {
          const reason = blockedReason(target, node.id);
          const blocked = target.rejection !== null;
          const label = textOf(target.node).trim() || REGISTRO_COPY.nodePlaceholder;
          return (
            <TargetRow
              key={target.node.id}
              label={label}
              // +1 porque la opción «raíz» ocupa el nivel 0 de la lista.
              depth={target.depth + 1}
              picked={picked === target.node.id}
              blocked={blocked}
              reason={reason}
              onClick={() => pick(target.node.id, target.rejection)}
            />
          );
        })}
      </div>

      {rejected || failure ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-primary bg-accent px-3.5 py-3"
        >
          <AlertIcon width={16} height={16} className="mt-0.5 shrink-0 text-primary" />
          <span className="text-xs leading-relaxed text-pretty">
            {failure ?? NODE_ERRORS[rejected as ReparentRule]}
          </span>
        </div>
      ) : null}
    </Dialog>
  );
}
