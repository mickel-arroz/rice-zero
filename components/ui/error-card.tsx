import { AlertIcon } from "@/components/icons/alert-icon";

/**
 * El recuadro de «esto no se pudo»: icono, qué pasó y qué hacer.
 *
 * Existe porque la misma tarjeta la pintan ya tres pantallas —el árbol que no
 * carga, el Proyecto cuya Versión activa no se pudo resolver, y la Versión que
 * la URL pide y no está— y el comentario de `tree-states.tsx` ya decía por qué
 * eso no puede ser tres copias: «dos copias divergirían en el peor sitio
 * posible — el texto que lee alguien cuando algo va mal». La regla valía; lo
 * que faltaba era el componente.
 *
 * Lo que NO trae es la acción: cada pantalla sabe cuál es la suya —reintentar,
 * elegir otra Versión, volver a la lista— y meterlas todas aquí obligaría a un
 * `kind` que decide por los tres.
 */
export function ErrorCard({
  title,
  body,
  children,
}: {
  title: string;
  /** Qué pasó, en español y ya resuelto. Nunca un objeto de error. */
  body: string;
  /** La salida: un botón, un enlace, una lista. */
  children?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3.5 rounded-[20px] border border-border bg-card p-7"
    >
      <AlertIcon width={28} height={28} className="text-primary" />
      <p className="text-center text-[15px] font-bold text-pretty">{title}</p>
      <p className="max-w-[258px] text-center text-xs leading-relaxed text-pretty text-muted-foreground">
        {body}
      </p>
      {children}
    </div>
  );
}
