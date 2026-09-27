import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/caveat/500.css";
import "./globals.css";
import { ThemeScript } from "@/components/theme/theme-script";

export const metadata: Metadata = {
  title: {
    default: "Quest Agent – Dein Faceless-Kanal. Läuft für dich.",
    template: "%s · Quest Agent",
  },
  description:
    "YouTube-Automation ohne Kamera und ohne Einsprechen: Nische und Vorbilder wählen, Uploadplan festlegen, prüfen, freigeben, fertig.",
  applicationName: "Quest Agent",
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffefa" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="light" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
