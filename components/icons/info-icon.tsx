import type { SVGProps } from "react";

/** Círculo con una i: la página Acerca de. */
export function InfoIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 11.5v4.5" />
      <path d="M12 8.2h.01" />
    </svg>
  );
}
