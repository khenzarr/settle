"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanonicalOrderStatus, PaymentIntentView } from "@settle/shared";
import type { BuyerOrderResponse } from "../lib/buyer-order-intent-service";
import { getCheckoutPresentation } from "../lib/checkout-presentation";
import { observeCanonicalState, paymentStateFromCanonicalOrder, shouldAnimateCanonicalTransition, type CanonicalObservation } from "../lib/checkout-motion";
import { BuyerPaymentFlow } from "./buyer-payment-flow";

const OBSERVATION_INTERVAL_MS = 4_000;

export function CheckoutCanonicalMotion({ paymentIntent }: { paymentIntent: PaymentIntentView }) {
  const [state, setState] = useState(paymentIntent.paymentState);
  const [canonicalStatus, setCanonicalStatus] = useState(paymentIntent.canonicalStatus);
  const observationRef = useRef<CanonicalObservation>({ observedState: paymentIntent.paymentState });
  const [motionClass, setMotionClass] = useState("");
  const presentation = getCheckoutPresentation({ paymentState: state });

  const observe = useCallback((order: BuyerOrderResponse) => {
    const next = paymentStateFromCanonicalOrder(order.status, order.fundingDeadlineExpired);
    const result = observeCanonicalState(observationRef.current, next);
    observationRef.current = result.observation;
    setState(next);
    setCanonicalStatus(order.statusLabel as CanonicalOrderStatus);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotionClass(shouldAnimateCanonicalTransition(result.transition, reduced) ? `checkout-motion--${next}` : "");
  }, []);

  useEffect(() => {
    if (!motionClass) return;
    const timer = window.setTimeout(() => setMotionClass(""), 320);
    return () => window.clearTimeout(timer);
  }, [motionClass]);

  useEffect(() => {
    if (paymentIntent.source !== "onchain") return;
    const controller = new AbortController();
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: paymentIntent.orderId, callerAddress: null }), signal: controller.signal });
        if (response.ok) observe(await response.json() as BuyerOrderResponse);
      } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) return; }
    }, OBSERVATION_INTERVAL_MS);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [observe, paymentIntent.orderId, paymentIntent.source]);

  const split = paymentIntent.settlementSummary.length > 0 ? <section className={`split-panel ${state === "completed" ? motionClass : ""}`} aria-labelledby="split-title"><span className="section-label">Programmable settlement</span><h2 id="split-title">Expected payout split</h2><p>Order terms define how the exact {paymentIntent.amount.usdc} USDC payment is distributed.</p><div className="split-list">{paymentIntent.settlementSummary.map((entry) => <div className="split-row" key={entry.recipient}><span className="split-branch" aria-hidden="true" /><span className="mono split-recipient" title={entry.recipient}>{entry.recipient.slice(0, 10)}…{entry.recipient.slice(-6)}</span><span>{(entry.shareBps / 100).toFixed(2)}%</span><strong>{entry.expectedAmountUsdc} USDC</strong><span className="bar" style={{ "--share": `${entry.shareBps / 100}%` } as React.CSSProperties} /></div>)}</div></section> : null;

  return <>
    <header className={`checkout-summary ${motionClass}`}><div><p className="eyebrow">Settle · hosted checkout</p><p className="checkout-kicker">Payment amount</p><p className="amount" aria-label={`${paymentIntent.amount.usdc} USDC`}>{paymentIntent.amount.usdc}<span className="amount-unit">USDC</span></p></div><div className="checkout-status"><span className={`status-badge ${presentation.tone}`}>Canonical status: {canonicalStatus}</span><p><strong>{presentation.headline}.</strong> {presentation.description}</p><span className="canonical-resolve-marker" aria-hidden="true">Converge <i /> Resolve</span></div></header>
    <BuyerPaymentFlow paymentIntent={paymentIntent} onCanonicalOrder={observe} />
    {split}
  </>;
}