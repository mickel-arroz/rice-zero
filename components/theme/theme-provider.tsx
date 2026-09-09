"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeColor } from "@/components/theme/theme-color";
import { THEMES } from "@/lib/constants";

/**
 * El tema de la app.
 *
 * Abre en OSCURO cuando nadie ha elegido todavía, y no en «sistema». RICE(0)
 * está dibujada en oscuro —es lo que enseña la portada y de lo que salieron los
 * bocetos—, así que seguir al sistema hacía que quien lo tuviera en claro no
 * viera nunca el tema que la app prefiere.
 *
 * `enableSystem` se queda PUESTO: el tema del sistema sigue siendo una opción
 * que se puede elegir a mano, y quitarlo la borraría del mapa. Lo que cambia es
 * cuál se ve por defecto, no cuáles hay.
 *
 * El tema claro no desaparece: sigue a un toque del conmutador, y la elección
 * sobrevive a recargar porque `next-themes` la guarda en `localStorage` y la
 * aplica con un script bloqueante ANTES del primer pintado — que es lo que hace
 * que esto no parpadee.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={THEMES.dark}
      enableSystem
      disableTransitionOnChange
    >
      {/* La barra de estado de la app instalada, al día con el tema elegido.
          No pinta nada; va aquí dentro porque de aquí sale el tema resuelto. */}
      <ThemeColor />
      {children}
    </NextThemesProvider>
  );
}
