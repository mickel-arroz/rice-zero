import type { SVGProps } from "react";

/** Sobre: el correo de confirmación que hay que abrir. */
export function MailIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <path d="M3.7 7.1 12 13l8.3-5.9" />
    </svg>
  );
}
