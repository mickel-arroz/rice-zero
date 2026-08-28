"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `true` a partir de la hidratación; `false` durante el render de servidor.
 *
 * Lo necesita todo lo que dependa del tema resuelto: en SSR no hay ninguno, así
 * que pintar «oscuro» o «claro» antes de hidratar sería adivinar, y adivinar
 * mal deja un parpadeo. Con `useSyncExternalStore` la respuesta del servidor y
 * la del primer render del cliente coinciden, que es lo que React exige.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
