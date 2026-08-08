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
  return <main><p className="eyebrow">Settle</p><h1>Pay with USDC</h1><section><dl><dt>Amount</dt><dd>{intent.amount.usdc} USDC</dd><dt>Network</dt><dd>{intent.network.blockchain}</dd><dt>Status</dt><dd>{intent.paymentState.split("-").map((word) => word[0]!.toUpperCase() + word.slice(1)).join(" ")}</dd><dt>Buyer</dt><dd>{intent.buyer}</dd></dl>{intent.evidence.warnings.map((warning) => <p className="warning" key={warning}>{warning} Canonical order state above remains authoritative.</p>)}{evidenceLinks.length > 0 && <div className="evidence"><h2>Settlement evidence</h2><ul>{evidenceLinks.map((link, index) => <li key={`${link.href}-${index}`}><a href={link.href} target="_blank" rel="noreferrer">{link.label} on ArcScan</a></li>)}</ul></div>}</section><BuyerPaymentFlow paymentIntent={intent} />{handoff ? <PaymentHandoffPanel handoff={handoff} /> : null}</main>;
}