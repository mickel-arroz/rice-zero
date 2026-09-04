import type { Metadata, Viewport } from "next";
import { DotPattern } from "@/components/backgrounds/dot-pattern";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { fontVariables } from "@/app/fonts";
import { APP_DESCRIPTION, APP_NAME, ROUTES } from "@/lib/constants";
import { APPLE_TOUCH_ICON, THEME_COLORS } from "@/lib/pwa/manifest";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  /**
   * La URL que Next publica para `app/manifest.ts`. Sin esta etiqueta el
   * navegador no lee el manifest y no ofrece instalar: el archivo puede estar
   * perfecto y la app seguir sin ser instalable.
   */
  manifest: ROUTES.manifest,
  /**
   * iOS no lee el manifest. Su equivalente son estas etiquetas, y sin ellas
   * «Añadir a pantalla de inicio» abre un Safari con barra de direcciones en vez
   * de la app.
   */
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    apple: [{ url: APPLE_TOUCH_ICON.src, sizes: APPLE_TOUCH_ICON.sizes }],
  },
};

/**
 * El color de la barra de estado cuando la app corre instalada.
 *
 * Va aquí y no en el manifest porque el manifest solo admite UN `theme_color` y
 * la app tiene dos temas. `viewport.themeColor` sí acepta media queries, así que
 * es el único sitio donde la barra puede seguir al tema de verdad. Los dos
 * valores salen de `THEME_COLORS`, que es donde `--background` está escrito en
 * hexadecimal para los dos que no entienden `oklch()`: esta etiqueta y el
 * manifest.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
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
          {/* El service worker y el aviso de sin conexión viven aquí por lo
              mismo que el fondo: no son de una pantalla, son de la app. El
              registro tiene que envolver al contenido —de él cuelga el contexto
              de Serwist—; el aviso es un hermano `fixed`, como el fondo. */}
          <ServiceWorker>
            {children}
            <OfflineBanner />
          </ServiceWorker>
        </ThemeProvider>
      </body>
    </html>
  );
}
