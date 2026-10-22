/**
 * Un trozo de silueta: el bloque que ocupa el sitio de algo que todavía viaja.
 *
 * Existe para que «cargando» no se confunda con «roto»: un bloque quieto se lee
 * como interfaz a medio pintar, y uno que respira dice que algo está pasando.
 * Por eso el pulso vive AQUÍ y no en cada pantalla —cinco copias de la
 * animación acabarían latiendo a cinco ritmos distintos.
 *
 * Lo que NO trae es la forma: alto, ancho y esquinas los pone quien compone,
 * porque cada silueta imita lo que viene —una fila, una tarjeta, un título— y
 * esa forma es justo lo que no se puede adivinar desde aquí.
 *
 * Es decorativo: quien compone pone el `aria-busy` y la etiqueta en el
 * contenedor, que es donde un lector de pantalla los busca.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-accent ${PULSE} ${className}`}
      style={style}
    />
  );
}

/** `motion-safe:` y no un `@media` aparte: la regla de movimiento reducido
 *  queda pegada a la animación que apaga. */
const PULSE = "motion-safe:animate-pulse";
