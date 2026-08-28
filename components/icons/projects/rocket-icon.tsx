import type { SVGProps } from "react";

/** Cohete: un lanzamiento. */
export function RocketIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 3c3 2.6 4.5 6.1 4.5 9.6L12 17l-4.5-4.4C7.5 9.1 9 5.6 12 3z" />
      <circle cx="12" cy="10" r="1.8" />
      <path d="m9 16.6-1.6 4.4 3.6-1.6" />
      <path d="m15 16.6 1.6 4.4-3.6-1.6" />
    </svg>
  );
}
