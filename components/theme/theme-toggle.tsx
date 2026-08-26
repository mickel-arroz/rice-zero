"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { THEME_TOGGLE_LABEL, THEMES } from "@/lib/constants";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true tras hidratar; en SSR no hay tema resuelto y el botón queda sin marcar
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isDark = mounted && resolvedTheme === THEMES.dark;

  return (
    <button
      type="button"
      aria-label={THEME_TOGGLE_LABEL}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? THEMES.light : THEMES.dark)}
      className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-accent"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
