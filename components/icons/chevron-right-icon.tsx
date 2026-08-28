import type { SVGProps } from "react";

/** Punta a la derecha: la sección está plegada. */
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m9.5 6 6 6-6 6" />
    </svg>
  );
}
