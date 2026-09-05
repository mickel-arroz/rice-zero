"use client";

import { usePathname } from "next/navigation";

import { useConnection } from "@/components/connection/connection-provider";
import { CheckIcon } from "@/components/icons/check-icon";
import { OfflineIcon } from "@/components/icons/offline-icon";
import { CONNECTION_COPY, ROUTES } from "@/lib/constants";
import { isSameOrUnder } from "@/lib/path";

/**
 * La franja que dice que no se puede editar, y que ya se puede otra vez.
 *
 * Vive en el layout raíz y no en cada pantalla porque quedarse sin conexión no
 * es un estado de una página: es un estado de la app. Y sale ANTES de que el
 * usuario intente algo, que es lo que separa «no puedes editar ahora» de un
 * error después de haber escrito un párrafo.
 *
 * ── Por qué arriba y a sangre, y no la pastilla flotante que era ──────────
 *
 * Nació en #18 como una pastilla anclada abajo, y ahí no cabe: la Vista
 * Registro tiene su barra de acciones pegada al borde inferior, así que el
 * aviso le caía justo encima — tapando los seis botones sobre los que venía a
 * hablar. Arriba y a sangre completa, además, se lee como CROMO de la app y no
 * como una tarjeta más de la pantalla, que es lo que es.
 *
 * `sticky` y no `fixed`: como hermano en flujo del contenido ocupa su alto en
 * vez de robárselo a la cabecera, y aun así no se va al desplazarse. Un
 * `fixed` habría tapado la marca en móvil, que es donde menos sitio hay.
 *
 * ── La regla de abajo ─────────────────────────────────────────────────────
 *
 * DISCONTINUA mientras no hay red y CONTINUA al volver. Es la única diferencia
 * visual entre los dos estados, y es la que cuenta la historia entera: la
 * línea rota es la conexión rota, y se cierra sola. Del mismo dialecto que el
 * subrayado punteado de los enlaces (`LINK_CLASS`).
 *
 * Lo que NO hay es un botón de reintentar. Quien reintenta es el sondeo de
 * Next, cada 3 s como mucho; un botón sería ofrecer un gesto que no cambia
 * nada. Ver `connection-provider.tsx`.
 */
export function ConnectionBanner() {
  const { phase } = useConnection();
  const pathname = usePathname();

  if (phase === "online") return null;

  // En `/offline` no sale: esa pantalla ya ES el aviso, con la misma frase en
  // su `h1` y su propio botón de reintentar, que se enciende solo al volver la
  // red. Repetirlo arriba sería decir dos veces lo mismo en la única pantalla
  // que no habla de otra cosa.
  if (isSameOrUnder(pathname, ROUTES.offline)) return null;

  const offline = phase === "offline";

  return (
    <div
      role="status"
      className={`sticky top-0 z-50 flex flex-col gap-1.5 border-b-2 bg-card px-6 py-3 lg:flex-row lg:items-center lg:gap-3 lg:px-16 ${
        offline ? "border-dashed border-primary" : "border-solid border-primary"
      }`}
    >
      {/* En escritorio esta fila se DISUELVE (`lg:contents`) y sus hijos pasan
          a ser hijos directos de la franja. Es lo que deja que el mismo
          marcado sea dos líneas en el teléfono —donde no cabe otra cosa— y una
          sola en escritorio, sin pintar el aviso dos veces ni esconder una
          copia con `hidden`. El `order` recoloca lo que quedó desordenado. */}
      <div className="flex items-center gap-2 lg:contents">
        <span className="flex shrink-0 text-primary lg:order-1">
          {offline ? (
            <OfflineIcon width={16} height={16} />
          ) : (
            <CheckIcon width={16} height={16} />
          )}
        </span>
        <span className="text-[11px] tracking-[0.18em] text-primary uppercase lg:order-2">
          {offline ? CONNECTION_COPY.offline : CONNECTION_COPY.back}
        </span>

        {/* Empuja la pastilla al otro extremo en móvil. En escritorio lo hace
            el `mr-auto` de la frase, porque ahí la frase va en medio. */}
        <span aria-hidden="true" className="flex-1 lg:hidden" />

        {offline ? (
          <span className="flex shrink-0 items-center gap-1.5 lg:order-4">
            {/* El mismo punto de 7 px con el que el pie del Autoguardado dice
                «algo está pasando ahora mismo». */}
            <span
              aria-hidden="true"
              className="size-[7px] rounded-full bg-primary"
            />
            <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
              {CONNECTION_COPY.retrying}
            </span>
          </span>
        ) : null}
      </div>

      <span className="text-[13px] leading-snug text-pretty lg:order-3 lg:mr-auto">
        {offline ? CONNECTION_COPY.offlineBody : CONNECTION_COPY.backBody}
      </span>
    </div>
  );
}
