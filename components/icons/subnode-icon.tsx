import type { SVGProps } from "react";

/** Baja y gira a la derecha: crear un subnodo. */
export function SubnodeIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M7 4v8.5A2.5 2.5 0 0 0 9.5 15H18" />
      <path d="m14.5 11.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}
