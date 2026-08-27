import type { SVGProps } from "react";

/** Triángulo de aviso: algo que el usuario tiene que leer. */
export function AlertIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10.2v3.8" />
      <path d="M12 16.6v.4" />
    </svg>
  );
}
