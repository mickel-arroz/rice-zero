import type { SVGProps } from "react";

/** Flecha diagonal: el enlace sale de la aplicación. */
export function ArrowUpRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 16 16 8" />
      <path d="M9 8h7v7" />
    </svg>
  );
}
