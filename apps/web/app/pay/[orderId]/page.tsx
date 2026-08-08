import { BuyerPaymentFlow } from "../../../components/buyer-payment-flow";
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
  const evidenceLinks = [...intent.evidence.lifecycle, ...intent.evidence.payouts].flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const value = entry as { explorerUrl?: unknown; label?: unknown };
    return typeof value.explorerUrl === "string" && typeof value.label === "string" ? [{ href: value.explorerUrl, label: value.label }] : [];
  });
  const statusLabel = intent.paymentState.split("-").map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ");
  const statusTone = ["completed", "funded"].includes(intent.paymentState) ? "success" : ["refunded", "cancelled"].includes(intent.paymentState) ? "danger" : intent.paymentState === "payment-window-expired" ? "warning" : "";
  return <main>
    <header className="page-header"><p className="eyebrow">Settle · hosted checkout</p><h1>Pay with USDC</h1><p className="lede">A clear, buyer-controlled payment handoff for marketplace orders. Funds are secured in escrow before settlement.</p></header>
    <section className="checkout-hero">
      <div><span className="section-label">Payment intent</span><p className="amount">{intent.amount.usdc}<span className="amount-unit">USDC</span></p><span className={`status-badge ${statusTone}`}>{statusLabel}</span></div>
      <div className="checkout-meta"><div><span>Network</span><strong>{intent.network.blockchain}</strong></div><div><span>Buyer</span><strong className="mono">{intent.buyer}</strong></div><div><span>Order</span><strong className="mono">{intent.orderId.slice(0, 10)}…{intent.orderId.slice(-8)}</strong></div></div>
    </section>
    {intent.settlementSummary.length > 0 && <section className="split-panel"><span className="section-label">Programmable settlement</span><h2>Expected payout split</h2><p>Settlement recipients are defined by the order terms and shown with exact projected amounts.</p><div className="split-list">{intent.settlementSummary.map((split) => <div className="split-row" key={split.recipient}><span className="mono">{split.recipient.slice(0, 10)}…{split.recipient.slice(-6)}</span><span>{(split.shareBps / 100).toFixed(2)}%</span><strong>{split.expectedAmountUsdc} USDC</strong><span className="bar" style={{ "--share": `${split.shareBps / 100}%` } as React.CSSProperties} /></div>)}</div></section>}
    <BuyerPaymentFlow paymentIntent={intent} />
    {intent.evidence.warnings.map((warning) => <aside className="warning-notice" key={warning}><span className="warning-icon" aria-hidden="true">!</span><p><strong>{warning}</strong> Canonical order state above remains authoritative.</p></aside>)}
    {evidenceLinks.length > 0 && <section className="evidence"><h2>Onchain evidence</h2><p>Supporting settlement records, available for verification on ArcScan.</p><ul>{evidenceLinks.map((link, index) => <li key={`${link.href}-${index}`}><a href={link.href} target="_blank" rel="noreferrer">{link.label} on ArcScan</a></li>)}</ul></section>}
    {handoff ? <PaymentHandoffPanel handoff={handoff} /> : null}
  </main>;
}