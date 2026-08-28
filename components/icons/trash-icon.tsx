import type { SVGProps } from "react";

/** Papelera: borrar. Lo único de la app que no se deshace. */
export function TrashIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7" />
      <path d="m6.8 7 .9 11.5A1.6 1.6 0 0 0 9.3 20h5.4a1.6 1.6 0 0 0 1.6-1.5L17.2 7" />
    </svg>
  );
}
