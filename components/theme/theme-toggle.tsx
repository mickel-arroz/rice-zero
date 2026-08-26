"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { THEME_LABELS, THEMES, type Theme } from "@/lib/constants";

const ORDER: Theme[] = [THEMES.light, THEMES.dark, THEMES.system];

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // true tras hidratar; en SSR no hay tema resuelto y ningún botón se marca activo
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      {ORDER.map((value) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {THEME_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
