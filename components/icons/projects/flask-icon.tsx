import type { SVGProps } from "react";

/** Matraz: un experimento. */
export function FlaskIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M10 3v6.2L5.2 17.6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.3-2.4L14 9.2V3" />
      <path d="M9 3h6" />
      <path d="M7.6 14h8.8" />
    </svg>
  );
}
