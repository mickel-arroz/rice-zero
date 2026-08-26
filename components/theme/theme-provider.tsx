"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { THEMES } from "@/lib/constants";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={THEMES.system}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
