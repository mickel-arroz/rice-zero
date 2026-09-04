"use client";

import { useEffect, useState } from "react";

/**
 * Cuántos segundos hace que pasó algo, repintando cada segundo.
 *
 * Existe por la cuenta atrás de la cuota: `retryPlan` es puro y recibe el
 * tiempo transcurrido como parámetro —para poder probarlo sin esperar treinta
 * y ocho segundos—, así que alguien tiene que traerle ese número, y ese alguien
 * es esto.
 *
 * Vive en su propio archivo porque lo usan DOS sitios a la vez: el botón de
 * generar y el aviso flotante, que enseñan la misma cuenta. Los dos la calculan
 * del mismo `since` y del mismo reloj, así que no pueden discrepar aunque sus
 * temporizadores no vayan al unísono.
 *
 * ── Dónde se mira el reloj, y por qué ahí ─────────────────────────────────
 *
 * Dentro del intervalo, que es el único sitio que vale. En el RENDER sería
 * impuro —`Date.now()` devuelve algo distinto en cada llamada, y React exige
 * que renderizar no dependa de eso—; en el cuerpo del EFECTO sería un
 * `setState` al montar, que es un render de más. Las dos las rechaza ESLint, y
 * las dos con razón.
 *
 * El precio es que el primer segundo vale cero, y es correcto: acaba de pasar.
 *
 * @param since cuándo pasó, en epoch ms. `null` mientras no ha pasado nada, y
 *   entonces no se monta ningún temporizador: un intervalo vivo repintando dos
 *   componentes cada segundo, para nada, durante toda la sesión.
 */
export function useElapsedSeconds(since: number | null): number {
  // La marca viaja CON los segundos, y no en un estado aparte, para poder
  // saber a cuál de los dos fallos pertenece la última medida. Sin eso, un
  // segundo fallo heredaría durante un segundo la cuenta del anterior y la
  // cuenta atrás arrancaría por la mitad.
  const [measured, setMeasured] = useState<{ at: number | null; seconds: number }>({
    at: null,
    seconds: 0,
  });

  useEffect(() => {
    if (since === null) return;
    const timer = setInterval(
      () => setMeasured({ at: since, seconds: (Date.now() - since) / 1000 }),
      1000,
    );
    return () => clearInterval(timer);
  }, [since]);

  return measured.at === since && since !== null ? measured.seconds : 0;
}
