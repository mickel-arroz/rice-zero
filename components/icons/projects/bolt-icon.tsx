import type { SVGProps } from "react";

/** Rayo: algo rápido o eléctrico. */
export function BoltIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M13 3 6 13.5h5L11 21l7-10.5h-5z" />
    </svg>
  );
}
