import type { SVGProps } from "react";

/** Cuatro esquinas hacia dentro: volver de pantalla completa. */
export function CollapseIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 9h5V4" />
      <path d="M20 9h-5V4" />
      <path d="M20 15h-5v5" />
      <path d="M4 15h5v5" />
    </svg>
  );
}
