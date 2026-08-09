import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { parsePublicAppOrigin } from "../lib/public-app-origin.server";
import { AppShell } from "../components/app-shell";

const metadataBase = (() => {
  try {
    return new URL(parsePublicAppOrigin(process.env));
  } catch {
    return undefined;
  }
})();
const ogImage = metadataBase ? new URL("/settle-og-default-1200x630.png", metadataBase).toString() : undefined;

const instrumentSans = localFont({
  src: "./fonts/InstrumentSans-Variable.woff2",
  display: "swap",
  weight: "400 700",
  style: "normal",
  variable: "--font-instrument-sans",
  fallback: ["Segoe UI Variable", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: "Settle",
  ...(metadataBase ? { metadataBase } : {}),
  description: "Programmable USDC settlement infrastructure for marketplaces and commerce.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/apple-touch-icon-180.png",
  },
  openGraph: {
    title: "Settle",
    description: "Programmable USDC settlement infrastructure for marketplaces and commerce.",
    type: "website",
    ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: "Settle" }] } : {}),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={instrumentSans.variable}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}