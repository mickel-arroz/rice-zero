import type { SVGProps } from "react";

/** Lápiz: editar. */
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.5 19.5h3.6L18.6 9a2.55 2.55 0 0 0-3.6-3.6L4.5 15.9z" />
      <path d="m13.8 6.6 3.6 3.6" />
    </svg>
  );
}
