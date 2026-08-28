import type { SVGProps } from "react";

/** Bandera: una meta o un hito. */
export function FlagIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M6 21V4" />
      <path d="M6 5h11l-2 3.5L17 12H6z" />
    </svg>
  );
}
