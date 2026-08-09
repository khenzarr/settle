"use client";

import type { PaymentHandoff } from "@settle/shared";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export type PaymentHandoffProps = { readonly handoff: PaymentHandoff };

export function PaymentHandoffPanel({ handoff }: PaymentHandoffProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copyLink() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(handoff.checkout.url);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  const shortOrderId = `${handoff.orderId.slice(0, 10)}...${handoff.orderId.slice(-8)}`;
  return (
    <section className="handoff-panel" aria-labelledby="handoff-title">
      <div className="handoff-heading">
        <div>
          <p className="eyebrow">Secure handoff</p>
          <h2 id="handoff-title">Open on another device</h2>
        </div>
      </div>
      <div className="handoff-content">
        <div className="handoff-qr" aria-label={`QR code for ${handoff.checkout.url}`}>
          <QRCodeSVG value={handoff.qr.payload} size={184} marginSize={2} level="M" />
        </div>
        <div className="handoff-details">
          <p>Scan to open this Settle checkout securely on another device. Scanning opens the checkout; it does not submit payment.</p>
          <dl className="handoff-metadata">
            <div><dt>Opens</dt><dd className="handoff-value handoff-host">{handoff.checkout.host}</dd></div>
            <div><dt>Order</dt><dd className="handoff-value handoff-order" title={handoff.orderId}>{shortOrderId}</dd></div>
            <div><dt>Amount</dt><dd className="handoff-value handoff-amount">{handoff.amount.usdc} USDC</dd></div>
            <div><dt>Network</dt><dd className="handoff-value handoff-network">{handoff.network.blockchain}</dd></div>
          </dl>
          <button className="secondary copy-link-button" type="button" onClick={() => void copyLink()}>{copied ? "✓ Copied" : "Copy payment link"}</button>
          {copyError && <div className="copy-link-recovery" role="status"><p className="read-only-note">Copy is unavailable in this browser. Select the checkout URL below or scan the code instead.</p><code>{handoff.checkout.url}</code></div>}
        </div>
      </div>
    </section>
  );
}