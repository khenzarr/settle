import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settle",
  description: "Programmable USDC settlement for modern commerce on Arc Testnet.",
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