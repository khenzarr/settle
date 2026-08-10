import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developer Integration Demo · Settle",
  description: "See how a marketplace can plan a Pay with USDC flow through Settle without triggering blockchain or Circle mutations.",
};

export default function DemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}