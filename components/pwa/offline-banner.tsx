"use client";

import { usePathname } from "next/navigation";
import { useOffline } from "next/offline";

import { OfflineIcon } from "@/components/icons/offline-icon";
import { PWA_COPY, ROUTES } from "@/lib/constants";
import { isSameOrUnder } from "@/lib/path";

/**
 * El aviso de que no hay red, en toda la app.
 *
 * Vive en el layout raíz y no en cada pantalla porque quedarse sin conexión no
 * es un estado de una página: es un estado de la app. Y sale ANTES de que el
 * usuario intente algo, que es lo que separa «no puedes editar ahora» de un
 * error después de haber escrito un párrafo.
 *
 * `useOffline` devuelve `false` en el servidor y hasta que hidrata, así que la
 * primera pintura nunca lo trae — no hay salto de layout al cargar con red.
 */
export function OfflineBanner() {
  const isOffline = useOffline();
  const pathname = usePathname();

  if (!isOffline) return null;

  // En `/offline` no sale: esa pantalla ya ES el aviso, con el mismo texto en
  // el `h1`. Y como el aviso está anclado abajo y no se va mientras no haya
  // red, ahí acabaría tapando para siempre los dos únicos botones de la
  // pantalla —justo los que sirven para salir de ella—.
  if (isSameOrUnder(pathname, ROUTES.offline)) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="flex max-w-md items-start gap-2.5 rounded-[14px] border border-primary bg-card px-4 py-3 shadow-popover">
        <span className="mt-px shrink-0 text-primary">
          <OfflineIcon width={18} height={18} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold">{PWA_COPY.offlineLabel}</span>
          <span className="text-xs leading-relaxed text-pretty text-muted-foreground">
            {PWA_COPY.bannerDetail}
          </span>
        </div>
      </div>
    </div>
  );
}
