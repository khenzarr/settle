import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settle",
  description: "Marketplace settlement software for Arc Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}