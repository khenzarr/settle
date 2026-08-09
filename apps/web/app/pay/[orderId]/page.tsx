import { CheckoutCanonicalMotion } from "../../../components/checkout-canonical-motion";
import { PaymentHandoffPanel } from "../../../components/payment-handoff";
import { loadPaymentIntent } from "../../../lib/payment-intent-service.server";
import { createPaymentHandoff } from "../../../lib/payment-handoff-service.server";
import { PublicAppOriginError } from "../../../lib/public-app-origin.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const intent = await loadPaymentIntent((await params).orderId);
  let handoff;
  try {
    handoff = createPaymentHandoff(intent);
  } catch (cause) {
    if (!(cause instanceof PublicAppOriginError)) throw cause;
  }
  const evidenceLinks = intent.evidence.payouts.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const value = entry as { explorerUrl?: unknown; label?: unknown };
    return typeof value.explorerUrl === "string" && typeof value.label === "string" ? [{ href: value.explorerUrl, label: value.label }] : [];
  });
  const lifecycleEntries = intent.evidence.lifecycle.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const value = entry as { explorerUrl?: unknown; label?: unknown; blockNumber?: unknown };
    return typeof value.explorerUrl === "string" && typeof value.label === "string" ? [{ href: value.explorerUrl, label: value.label, block: typeof value.blockNumber === "string" ? value.blockNumber : null }] : [];
  });
  return <div className="content-container page-frame page-frame--checkout">
    <CheckoutCanonicalMotion paymentIntent={intent} />
    <section className="checkout-context" aria-labelledby="checkout-context-title"><div className="section-heading"><div><p className="eyebrow">Order context</p><h2 id="checkout-context-title">{intent.checkout.paymentActionAvailable ? "Know what you are authorizing" : "Payment context"}</h2></div><span className="context-network">{intent.network.blockchain}</span></div><dl className="context-grid"><div><dt>Network</dt><dd>{intent.network.blockchain} <span className="technical">chain {intent.network.chainId}</span></dd></div><div><dt>Buyer</dt><dd className="mono" title={intent.buyer}>{intent.buyer}</dd></div><div><dt>Order</dt><dd className="mono" title={intent.orderId}>{intent.orderId.slice(0, 10)}…{intent.orderId.slice(-8)}</dd></div></dl></section>
    <section className="evidence-section" aria-labelledby="lifecycle-title"><div className="section-heading"><div><p className="eyebrow">Canonical record</p><h2 id="lifecycle-title">Lifecycle and evidence</h2></div><span className="evidence-state">{intent.evidence.completeness === "complete" ? "Evidence available" : "Evidence limited"}</span></div>{lifecycleEntries.length > 0 ? <ol className="checkout-timeline">{lifecycleEntries.map((entry) => <li key={`${entry.href}-${entry.label}`}><strong>{entry.label}</strong><span>{entry.block ? `Block ${entry.block} · ` : ""}<a href={entry.href} target="_blank" rel="noreferrer">View evidence</a></span></li>)}</ol> : <p className="read-only-note">Canonical lifecycle events are not currently available.</p>}{intent.evidence.warnings.map((warning) => <aside className="warning-notice" key={warning}><span className="warning-icon" aria-hidden="true">!</span><p><strong>{warning}</strong> Canonical order state above remains authoritative.</p></aside>)}{evidenceLinks.length > 0 && <div className="evidence-links"><span className="section-label">Supporting records</span><ul>{evidenceLinks.map((link, index) => <li key={`${link.href}-${index}`}><a href={link.href} target="_blank" rel="noreferrer">{link.label} on ArcScan</a></li>)}</ul></div>}</section>
    {handoff ? <PaymentHandoffPanel handoff={handoff} /> : null}
  </div>;
}