import type { SVGProps } from "react";

/** Un padre y dos hijos: el árbol de Nodos. */
export function NodesIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="6" cy="18.5" r="2.2" />
      <circle cx="18" cy="18.5" r="2.2" />
      <path d="M12 7.2v3.3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 0 6 13.5v2.8" />
      <path d="M12 7.2v3.3a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 1 1.5 1.5v2.8" />
    </svg>
  );
}
