"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ContrastIcon } from "@/components/icons/contrast-icon";
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
      className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <ContrastIcon />
    </button>
  );
}
