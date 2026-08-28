import type { SVGProps } from "react";

/** Círculo tachado: una opción que no se puede elegir. */
export function BlockedIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="8" />
      <path d="m6.5 6.5 11 11" />
    </svg>
  );
}
