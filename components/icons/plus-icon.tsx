import type { SVGProps } from "react";

/** Cruz: crear algo nuevo. */
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </svg>
  );
}
