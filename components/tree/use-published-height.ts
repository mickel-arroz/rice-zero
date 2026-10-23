"use client";

import { useCallback } from "react";

/**
 * Publica el alto de un elemento como variable CSS en `<html>`, y lo retira al
 * desmontarse.
 *
 * Existe por la barra de acciones del Nodo: es `sticky` sobre el borde de abajo
 * de lo que se desplaza, así que un Nodo recién creado —que nace al final de la
 * lista y con el foco dentro— aterrizaba DEBAJO de ella. El navegador ya sabe
 * dejar sitio a lo que tapa un borde (`scroll-padding`, el mismo arreglo que la
 * cabecera del teléfono tiene en `globals.css`), pero necesita el número, y el
 * de la barra no es fijo: cambia con el ancho, con la vista y con lo que se
 * ponga dentro el día de mañana. Medirlo es lo único que no se desincroniza.
 *
 * Va en `<html>` y no en el Contenedor que se desplaza porque en el teléfono el
 * que se desplaza ES `<html>`, y en escritorio el que se desplaza la lee por
 * herencia.
 *
 * ── Un ref de callback que devuelve su limpieza ──────────────────────────
 *
 * Y no un `useEffect` aparte: la limpieza de un efecto corre DESPUÉS de que se
 * enganchen los refs del mismo commit, así que al pasar del Canvas al Registro
 * la barra que se iba borraba la variable que la que llegaba acababa de poner.
 * La limpieza del ref corre en su sitio, antes del ref nuevo.
 *
 * Desactivado no toca nada —ni pone ni quita—: la barra del Canvas no reserva,
 * pero tampoco le corresponde borrar lo que haya publicado otra.
 */
export function usePublishedHeight<T extends HTMLElement>(
  variable: string,
  enabled = true,
) {
  return useCallback(
    (el: T | null) => {
      if (!el || !enabled) return;
      const root = document.documentElement;
      // `offsetHeight` y no el `contentRect` del observador: el relleno de
      // arriba de la barra también tapa, y `contentRect` lo deja fuera.
      const publish = () =>
        root.style.setProperty(variable, `${el.offsetHeight}px`);
      publish();
      const observer = new ResizeObserver(publish);
      observer.observe(el);
      return () => {
        observer.disconnect();
        root.style.removeProperty(variable);
      };
    },
    [variable, enabled],
  );
}
