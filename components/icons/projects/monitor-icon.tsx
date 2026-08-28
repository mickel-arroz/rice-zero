import type { SVGProps } from "react";

/** Monitor con pie: una aplicación de escritorio o web. */
export function MonitorIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16.5V20" />
    </svg>
  );
}
