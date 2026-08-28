import type { SVGProps } from "react";

/** Láminas apiladas: algo con capas. */
export function LayersIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m12 4 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 13.5 8 4.5 8-4.5" />
    </svg>
  );
}
