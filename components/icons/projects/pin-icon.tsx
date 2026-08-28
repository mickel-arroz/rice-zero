import type { SVGProps } from "react";

/** Chincheta de mapa: algo con lugar. */
export function PinIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M12 21s6-5.3 6-9.8A6 6 0 0 0 6 11.2C6 15.7 12 21 12 21z" />
      <circle cx="12" cy="11" r="2.3" />
    </svg>
  );
}
