import type { SVGProps } from "react";

/** Dos cuadros, uno detrás del otro: clonar una Versión. */
export function CloneIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 4.5H6.5a2 2 0 0 0-2 2v9" />
    </svg>
  );
}
