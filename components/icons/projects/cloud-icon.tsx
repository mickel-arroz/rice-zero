import type { SVGProps } from "react";

/** Nube: infraestructura o servicio remoto. */
export function CloudIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M7.5 18.5a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 18 11.3a3.6 3.6 0 0 1-.6 7.2z" />
    </svg>
  );
}
