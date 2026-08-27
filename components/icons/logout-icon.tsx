import type { SVGProps } from "react";

/** Flecha que sale de una puerta: cerrar la sesión. */
export function LogoutIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="m10 8-4 4 4 4" />
      <path d="M6 12h9" />
    </svg>
  );
}
