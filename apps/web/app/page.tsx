"use client";

import { useState } from "react";
import { ARC_TESTNET, getExplorerTransactionUrl } from "@settle/shared";
import { connectWallet, submitBuyerTransaction, switchToArcTestnet, type BuyerSubmissionResult, type Eip1193Provider, type WalletState } from "../lib/buyer-wallet-adapter";
import type { BuyerOrderResponse, JsonIntent } from "../lib/buyer-order-intent-service";

declare global { interface Window { ethereum?: Eip1193Provider } }

function executableIntent(intent: JsonIntent) { return { ...intent, value: 0n } as never; }

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ account: null, chainId: null });
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<BuyerOrderResponse | null>(null);
  const [approveSubmitted, setApproveSubmitted] = useState(false);
  const [result, setResult] = useState<BuyerSubmissionResult | null>(null);
  const [error, setError] = useState("");
  const provider = () => { if (!window.ethereum) throw new Error("No injected EVM wallet found"); return window.ethereum; };
  async function run(action: () => Promise<void>) { setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet request failed"); } }

  return <main>
    <p className="eyebrow">D4B buyer execution proof</p><h1>Settle wallet adapter</h1>
    <p>The server reads the canonical on-chain order and prepares read-only buyer intent previews. This browser never reconstructs calldata.</p>
    <section><h2>Wallet</h2>
      <button onClick={() => run(async () => setWallet(await connectWallet(provider())))}>Connect wallet</button>
      <dl><dt>Address</dt><dd>{wallet.account ?? "Not connected"}</dd><dt>Chain</dt><dd>{wallet.chainId ?? "Unknown"}{wallet.chainId === ARC_TESTNET.chainId ? " — Arc Testnet" : ""}</dd></dl>
      {wallet.chainId !== null && wallet.chainId !== ARC_TESTNET.chainId && <button className="secondary" onClick={() => run(async () => { await switchToArcTestnet(provider()); setWallet(await connectWallet(provider())); })}>Switch to Arc Testnet</button>}
    </section>
    <section><h2>Order-backed buyer intent</h2>
      <label htmlFor="orderId">Order ID (bytes32)</label>
      <input id="orderId" value={orderId} onChange={(event) => { setOrderId(event.target.value); setOrder(null); setResult(null); setApproveSubmitted(false); }} placeholder="0x…" />
      <button onClick={() => run(async () => { const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const body = await response.json() as BuyerOrderResponse | { error?: { message?: string } }; if (!response.ok) throw new Error("error" in body && body.error?.message ? body.error.message : "Unable to load order"); setOrder(body as BuyerOrderResponse); setApproveSubmitted(false); })}>Load order</button>
      {order && <><dl><dt>Buyer</dt><dd>{order.buyer}</dd><dt>Amount</dt><dd>{order.amount.usdc} USDC ({order.amount.baseUnits} base units)</dd><dt>Status</dt><dd>{order.statusLabel}</dd><dt>Deadline</dt><dd>{order.fundingDeadline} ({order.fundingDeadlineOpen ? "open" : "expired"})</dd><dt>Allowance</dt><dd>{order.allowance.usdc} USDC ({order.allowance.baseUnits} base units)</dd></dl>
      <IntentPreview title="Approve operation preview" intent={order.approveIntent} />
      <button disabled={!wallet.account || approveSubmitted} onClick={() => run(async () => { const submission = await submitBuyerTransaction(executableIntent(order.approveIntent), provider()); setResult(submission); setApproveSubmitted(true); })}>Approve</button>
      <IntentPreview title="Fund operation preview" intent={order.fundIntent} />
      <button disabled={!wallet.account || !order.fundReady || approveSubmitted} onClick={() => run(async () => setResult(await submitBuyerTransaction(executableIntent(order.fundIntent), provider())))}>Fund</button>
      {approveSubmitted && <p>Approval submitted/not finalized. Refresh order state before Fund can become enabled.</p>}
      <button className="secondary" onClick={() => run(async () => { const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const body = await response.json() as BuyerOrderResponse; if (!response.ok) throw new Error("Unable to refresh order"); setOrder(body); setApproveSubmitted(false); })}>Refresh order state</button></>}
    </section>
    {result && <section><h2>Submitted (not finalized)</h2><a href={getExplorerTransactionUrl(result.hash as `0x${string}`)} target="_blank" rel="noreferrer">{result.hash}</a></section>}
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}

function IntentPreview({ title, intent }: { title: string; intent: JsonIntent }) { return <div className="preview"><strong>{title}</strong><span>{intent.summary}</span><code>chain {intent.chainId}</code><code>from {intent.from}</code><code>to {intent.to}</code><code>data {intent.data}</code></div>; }