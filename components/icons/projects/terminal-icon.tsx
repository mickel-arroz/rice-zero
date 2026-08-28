import type { SVGProps } from "react";

/** Ventana de terminal: una herramienta de línea de comandos. */
export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="m7.5 10 2.5 2.2-2.5 2.2" />
      <path d="M12.5 15h4" />
    </svg>
  );
}
