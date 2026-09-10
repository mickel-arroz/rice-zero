"use client";

import { useCallback } from "react";

import { useBlocked } from "@/components/connection/connection-provider";
import { fire } from "@/components/tree/fire";
import { useNodeDialogs } from "@/components/tree/node-dialogs";
import { useTree } from "@/components/tree/tree-provider";
import {
  isTypingStroke,
  resolveTreeKey,
  type KeyStroke,
} from "@/lib/tree/keymap";
import { isBlank } from "@/lib/tree/model";

/**
 * El cableado del mapa de teclado: de un evento del navegador a una operación
 * del árbol.
 *
 * Aquí NO se decide nada. Qué hace cada tecla lo contesta `lib/tree/keymap.ts`,
 * que es puro y tiene su test de tabla; esto solo traduce el evento, llama al
 * provider y decide una cosa de interfaz: qué se hace cuando el mapa devuelve
 * una acción que no procede sobre este Nodo concreto —el primero no puede
 * subir, uno sin hijos no se puede plegar—. La respuesta es no hacer nada y
 * dejar que la tecla se pierda, igual que hace la barra con su botón apagado.
 *
 * Vive en `components/tree` y lo comparten las dos vistas, por lo mismo que
 * `NodeActions`: mientras compartan cableado, «lo que hace Mod+Enter» no puede
 * significar una cosa en el Registro y otra en el Canvas.
 *
 * ── Las dos acciones que abren un diálogo ─────────────────────────────────
 *
 * `reparent` y `remove` no escriben: piden. Los diálogos los monta
 * `NodeDialogs`, que es donde vive «cuál está delante» — estado de la pantalla
 * y no del árbol. Se piden por contexto y no por props porque quien recibe la
 * pulsación es una FILA, y hacer bajar dos callbacks fila a fila solo para dos
 * teclas habría atado la lista entera a algo que no es suyo.
 *
 * @param nodeId el Nodo de la fila que recibe la pulsación. Puede no ser el
 *   seleccionado: se teclea sobre el que tiene el foco, y seleccionar es lo
 *   primero que hace escribir en él.
 */
export function useTreeKeys(nodeId: string) {
  const tree = useTree();
  const blocked = useBlocked();
  const { openMove, openDelete } = useNodeDialogs();

  const {
    rows,
    visibleRows,
    collapsedIds,
    selectedId,
    editingId,
    select,
    startEditing,
    setText,
    textOf,
    nodes,
    createSibling,
    createChild,
    moveTo,
    setCompleted,
    toggleCollapsed,
  } = tree;

  return useCallback(
    (event: React.KeyboardEvent) => {
      const stroke: KeyStroke = {
        key: event.key,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        shift: event.shiftKey,
        alt: event.altKey,
      };

      const selected = selectedId !== null;
      const editing = editingId !== null;

      // ── Escape quita la selección ───────────────────────────────────────
      //
      // Es la octava acción de la barra —«Quitar»— y la única que no está en el
      // mapa. No es una excepción a «todo atajo lleva modificador»: `Escape` no
      // se puede teclear dentro de un Nodo, así que no compite con nada, y ya
      // es el «cancelar» de los diálogos y del selector de Versiones. Ponerle
      // un modificador lo habría hecho distinto de sí mismo en el resto de la
      // app. Ver la cabecera de `lib/tree/keymap.ts`.
      //
      // Con el campo abierto NO llega aquí: allí Escape cierra el campo, y lo
      // atiende la propia fila antes de ofrecernos la pulsación.
      if (event.key === "Escape") {
        if (!selected) return;
        event.preventDefault();
        select(null);
        return;
      }

      // ── Teclear escribe, sin gesto previo ───────────────────────────────
      //
      // Con el campo ya abierto no pasa por aquí: lo recoge el `textarea`. Esto
      // es el caso de un Nodo enfocado y CERRADO, donde antes había que pulsar
      // otra vez antes de poder escribir.
      //
      // El carácter se añade al final del texto que ya hay, y no lo sustituye:
      // enfocar un Nodo escrito y teclear es seguir escribiendo. `preventDefault`
      // es lo que evita que el navegador lo entregue además al campo que se
      // acaba de abrir y salga duplicado.
      if (!editing && isTypingStroke(stroke)) {
        event.preventDefault();
        if (blocked) return;

        const node = nodes.find((candidate) => candidate.id === nodeId);
        if (!node) return;

        startEditing(nodeId);
        setText(nodeId, `${textOf(node)}${event.key}`);
        return;
      }

      const action = resolveTreeKey(stroke, { selected, editing });
      if (action === null) return;

      // El foco se mueve sobre lo VISIBLE: un subárbol plegado no está en la
      // pantalla, y llevar el foco a algo que no se ve es perderlo.
      const order = visibleRows;
      const at = order.findIndex((row) => row.node.id === selectedId);

      if (action === "focusPrev" || action === "focusNext") {
        event.preventDefault();
        if (order.length === 0) return;

        // Sin selección se entra por un extremo u otro, según por dónde se
        // venga. Con selección se avanza, y en los bordes se para en vez de dar
        // la vuelta: un árbol no es un carrusel, y saltar del último al primero
        // desorienta más de lo que ahorra.
        const next =
          at === -1
            ? action === "focusNext"
              ? 0
              : order.length - 1
            : Math.min(
                Math.max(at + (action === "focusNext" ? 1 : -1), 0),
                order.length - 1,
              );

        select(order[next].node.id);
        return;
      }

      // A partir de aquí todo actúa sobre el Nodo seleccionado, y se busca en
      // el árbol ENTERO: la fila que lo describe existe aunque su rama esté
      // plegada por encima.
      const row = rows.find((candidate) => candidate.node.id === selectedId);
      if (!row) return;
      const id = row.node.id;

      // El portazo, como en `run`: sin red no se escribe. Plegar es la
      // excepción y por eso se resuelve antes — vive en el navegador.
      if (action === "collapse" || action === "expand") {
        event.preventDefault();
        if (!row.hasChildren) return;
        if (collapsedIds.has(id) === (action === "collapse")) return;
        toggleCollapsed(id);
        return;
      }

      if (blocked) return;
      event.preventDefault();

      switch (action) {
        case "createSibling":
          // Un Nodo sin texto no ramifica. Se comprueba aquí y no en el mapa
          // por lo mismo que los bordes de «Subir»: es del Nodo, no de la
          // tecla. Misma función que apaga los dos botones de la barra, y
          // sobre el borrador por lo mismo — teclear y ramificar seguido no
          // puede tropezar con el rebote del autoguardado.
          if (isBlank(textOf(row.node))) return;
          fire(createSibling(id));
          return;
        case "createChild":
          if (isBlank(textOf(row.node))) return;
          fire(createChild(id));
          return;
        case "moveUp":
          // Los bordes se comprueban aquí y no en el mapa: «no hay a dónde
          // subir» es del Nodo, no de la tecla. Es la misma condición que apaga
          // el botón de la barra.
          if (row.index === 0) return;
          fire(moveTo(id, row.index - 1));
          return;
        case "moveDown":
          if (row.index === row.siblingCount - 1) return;
          fire(moveTo(id, row.index + 1));
          return;
        case "toggleCompleted":
          // Bajo un padre terminado no hay nada que cambiar: el Nodo ya se ve
          // tachado. Misma regla que apaga el botón, leída del mismo sitio.
          if (row.struck && !row.node.completed) return;
          fire(setCompleted(id, !row.node.completed));
          return;
        case "reparent":
          openMove(id);
          return;
        case "remove":
          openDelete(id);
          return;
      }
    },
    [
      blocked,
      collapsedIds,
      createChild,
      createSibling,
      editingId,
      moveTo,
      nodeId,
      nodes,
      openDelete,
      openMove,
      rows,
      select,
      selectedId,
      setCompleted,
      setText,
      startEditing,
      textOf,
      toggleCollapsed,
      visibleRows,
    ],
  );
}
