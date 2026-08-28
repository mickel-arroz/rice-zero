import type { SVGProps } from "react";

/** Punta abajo: la sección está desplegada. */
export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}
