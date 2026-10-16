import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { Toaster } from "sonner";

import { SiteAnalytics } from "@/components/site-analytics";
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE_NAME} | Productos Natura a precios especiales`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Productos Natura a precios especiales`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fff7ef",
  width: "device-width",
  initialScale: 1,
  // Al girar el celular (horizontal → vertical) el iPhone a veces deja la página achicada;
  // con esto vuelve siempre a su tamaño. Igual se puede agrandar con dos dedos.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${fredoka.variable} ${nunito.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        {children}
        <Toaster
          position="top-center"
          // En el celular, los avisos de abajo quedan por encima de la barra de «Agregar al carrito».
          mobileOffset={{ bottom: 96 }}
          richColors
          closeButton
          toastOptions={{ style: { fontFamily: "var(--font-nunito)" } }}
        />
        <SiteAnalytics />
      </body>
    </html>
  );
}
