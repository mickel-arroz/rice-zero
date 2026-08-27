import type { SVGProps } from "react";

/** Ondas tachadas: no hay conexión con el backend. */
export function OfflineIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4 4.6 19.4 20" />
      <path d="M8.7 15.3a4.7 4.7 0 0 1 5.2-1" />
      <path d="M5.4 12a9.3 9.3 0 0 1 3.1-2" />
      <path d="M15.9 10.2A9.3 9.3 0 0 1 18.9 12" />
      <path d="M12 18.6v.4" />
    </svg>
  );
}
