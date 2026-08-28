import type { SVGProps } from "react";

/** Una línea más, con una cruz: crear un Nodo hermano. */
export function SiblingIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.5 7h15" />
      <path d="M4.5 17h7" />
      <path d="M17 13.5v7" />
      <path d="M13.5 17h7" />
    </svg>
  );
}
