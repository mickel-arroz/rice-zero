import type { SVGProps } from "react";

/**
 * Flecha que baja y gira hacia dentro: llevar algo al árbol.
 *
 * Se llama por lo que HACE y no por lo que dibuja, al revés que la mayoría del
 * catálogo, porque lo que dibuja es una rama — y `CONTEXT.md` lista «rama» en
 * los términos a evitar: choca con Versión, que es lo que una persona que viene
 * de git entiende por ella.
 */
export function ToTreeIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M7 5v8a2 2 0 0 0 2 2h8" />
      <path d="m14 11.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}
