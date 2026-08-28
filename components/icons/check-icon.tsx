import type { SVGProps } from "react";

/** Marca: hecho. La usa el Autoguardado para decir que ya está. */
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="m5.5 12.5 4.5 4.5L18.5 7" />
    </svg>
  );
}
