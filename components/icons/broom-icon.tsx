import type { SVGProps } from "react";

/** Una escoba: la Limpieza de lo terminado. */
export function BroomIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M14 4l6 6" />
      <path d="M17 7l-7 7" />
      <path d="M10 14l-5 1 1 4 4 1 1-5z" />
    </svg>
  );
}
