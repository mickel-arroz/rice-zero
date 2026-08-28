import type { SVGProps } from "react";

/** Gota: algo líquido, o un goteo constante. */
export function DropIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 21a5.5 5.5 0 0 0 5.5-5.5c0-4.5-5.5-9.5-5.5-9.5S6.5 11 6.5 15.5A5.5 5.5 0 0 0 12 21z" />
    </svg>
  );
}
