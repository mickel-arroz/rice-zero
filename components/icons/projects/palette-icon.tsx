import type { SVGProps } from "react";

/** Paleta con manchas: diseño. */
export function PaletteIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2A5 5 0 0 0 21 9.7c0-3.5-4-6.2-9-6.2z" />
      <circle cx="8" cy="10" r="1.2" />
      <circle cx="12" cy="7.8" r="1.2" />
      <circle cx="16" cy="10.5" r="1.2" />
    </svg>
  );
}
