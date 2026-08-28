"use client";

import { useTheme } from "next-themes";
import { ContrastIcon } from "@/components/icons/contrast-icon";
import { ICON_BUTTON_CLASS } from "@/components/layout/site-chrome";
import { useMounted } from "@/components/theme/use-mounted";
import { THEME_TOGGLE_LABEL, THEMES } from "@/lib/constants";

/**
 * El estado del tema, para quien lo pinte como sea.
 *
 * Lo comparten el botón redondo de las páginas públicas y la fila «Tema» del
 * shell: dos formas muy distintas de enseñar exactamente la misma decisión.
 */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true tras hidratar; en SSR no hay tema resuelto y el botón queda sin marcar
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === THEMES.dark;

  return {
    isDark,
    toggle: () => setTheme(isDark ? THEMES.light : THEMES.dark),
  };
}

export function ThemeToggle() {
  const { isDark, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      aria-label={THEME_TOGGLE_LABEL}
      aria-pressed={isDark}
      onClick={toggle}
      className={ICON_BUTTON_CLASS}
    >
      <ContrastIcon />
    </button>
  );
}
