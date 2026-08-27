import type { Metadata } from "next";
import { DotPattern } from "@/components/backgrounds/dot-pattern";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { fontVariables } from "@/app/fonts";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          {/* El fondo de puntos es de TODA la app, no de una página: vive aquí
              para que ninguna ruta nueva pueda salir sin él. Es `fixed` y no
              interactivo, así que se monta como hermano del contenido —nunca
              envolviéndolo— y el contenido se pone encima con `relative z-10`. */}
          <DotPattern />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
