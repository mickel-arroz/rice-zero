import type { SVGProps } from "react";

/** Dos flechas encontradas: re-parentar, colgarlo de otro sitio. */
export function MoveIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 8.5h11" />
      <path d="m11.5 5 3.5 3.5-3.5 3.5" />
      <path d="M20 15.5H9" />
      <path d="m12.5 12-3.5 3.5 3.5 3.5" />
    </svg>
  );
}
