import type { SVGProps } from "react";

/** Hoja: algo que crece, o naturaleza. */
export function LeafIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M5 19C5 11 9.5 6 20 5c.6 8.5-4 14-11 14z" />
      <path d="M5 19c3-5.5 6.5-8.5 11-10" />
    </svg>
  );
}
