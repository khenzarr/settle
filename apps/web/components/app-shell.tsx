import Link from "next/link";
import type { ReactNode } from "react";

function BrandLink({ footer = false }: { footer?: boolean }) {
  return (
    <Link className={`brand-link${footer ? " brand-link--footer" : ""}`} href="/" aria-label="Settle home">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-word">Settle</span>
    </Link>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell-container site-header__inner">
        <div className="site-header__identity">
          <BrandLink />
          <span className="site-header__descriptor">Programmable USDC settlement</span>
        </div>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/">Home</Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell-container site-footer__inner">
        <div className="site-footer__brand">
          <BrandLink footer />
          <p>Programmable USDC settlement infrastructure for marketplaces and commerce.</p>
        </div>
        <div className="site-footer__context" aria-label="Network context">
          <p>Built on Arc</p>
          <p>Arc Testnet <span aria-hidden="true">·</span> USDC settlement</p>
        </div>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </div>
  );
}