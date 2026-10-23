import type { SVGProps } from "react";

/**
 * Círculo con núcleo: el nodo cero. Es el icono por defecto. Trazo de Lucide
 * `circle-dot`.
 */
export function NodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
