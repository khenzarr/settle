"use client";

import { useState } from "react";
import { ARC_TESTNET, getExplorerTransactionUrl } from "@settle/shared";
import { connectWallet, submitBuyerTransaction, switchToArcTestnet, type BuyerSubmissionResult, type Eip1193Provider, type WalletState } from "../lib/buyer-wallet-adapter";
import type { BuyerOrderResponse, JsonIntent } from "../lib/buyer-order-intent-service";
import type { BuyerConfirmationResponse } from "../lib/buyer-transaction-confirmation";
import { composeBuyerOperationState, projectOrderActionState } from "../lib/order-action-state";
import { createBuyerOperation, projectBuyerOperation, transitionBuyerOperation, type BuyerOperation, type BuyerOperationRecord } from "../lib/buyer-transaction-progress";

declare global { interface Window { ethereum?: Eip1193Provider } }

function executableIntent(intent: JsonIntent) { return { ...intent, value: 0n } as never; }

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ account: null, chainId: null });
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<BuyerOrderResponse | null>(null);
  const [approveOperation, setApproveOperation] = useState<BuyerOperationRecord>(() => createBuyerOperation("", "approve"));
  const [fundOperation, setFundOperation] = useState<BuyerOperationRecord>(() => createBuyerOperation("", "fund"));
  const [result, setResult] = useState<BuyerSubmissionResult | null>(null);
  const [confirmation, setConfirmation] = useState<BuyerConfirmationResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const actionState = order ? composeBuyerOperationState(projectOrderActionState({ status: Number(order.status), buyer: order.buyer, connectedAccount: wallet.account, fundingDeadlineOpen: order.fundingDeadlineOpen, allowance: BigInt(order.allowance.baseUnits), requiredAmount: BigInt(order.amount.baseUnits) }), projectBuyerOperation(approveOperation.progress !== "idle" ? approveOperation : fundOperation.progress !== "idle" ? fundOperation : createBuyerOperation(orderId, "approve"))) : null;
  const provider = () => { if (!window.ethereum) throw new Error("No injected EVM wallet found"); return window.ethereum; };
  async function run(action: () => Promise<void>) { setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Wallet request failed"); } }
  function setOperation(operation: BuyerOperation, event: Parameters<typeof transitionBuyerOperation>[1]) {
    const setter = operation === "approve" ? setApproveOperation : setFundOperation;
    setter((current) => transitionBuyerOperation(current, event));
  }
  async function confirm(operation: BuyerOperation, hash: string) {
    let current = operation === "approve" ? approveOperation : fundOperation;
    const advance = (event: Parameters<typeof transitionBuyerOperation>[1]) => {
      current = transitionBuyerOperation(current, event);
      const setter = operation === "approve" ? setApproveOperation : setFundOperation;
      setter(current);
    };
    setConfirming(true);
    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const confirmationOperation = operation === "approve" ? "approve-usdc" : "fund-order";
        const response = await fetch("/api/buyer/transaction/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, transactionHash: hash, operation: confirmationOperation }) });
        const body = await response.json() as BuyerConfirmationResponse | { error?: { message?: string } };
        if (!response.ok) throw new Error("error" in body && body.error?.message ? body.error.message : "Unable to confirm transaction");
        const next = body as BuyerConfirmationResponse;
        setConfirmation(next);
        if (next.confirmationStatus === "pending" && current.progress === "pending-receipt") advance({ type: "receipt-pending" });
        else if (next.confirmationStatus === "reverted" && current.progress === "pending-receipt") advance({ type: "receipt-reverted" });
        else if (next.confirmationStatus === "included-awaiting-state" && current.progress === "pending-receipt") advance({ type: "receipt-included" });
        else if (next.confirmationStatus === "pending" && current.progress === "submitting") advance({ type: "receipt-pending" });
        else if (next.confirmationStatus === "reverted" && current.progress === "submitting") advance({ type: "submission-returned-hash", transactionHash: hash });
        else if (next.confirmationStatus === "included-awaiting-state" && current.progress === "submitting") advance({ type: "submission-returned-hash", transactionHash: hash });
        if (next.confirmationStatus === "state-confirmed") {
          if (current.progress === "pending-receipt") advance({ type: "receipt-included" });
          if (current.progress === "included-awaiting-state") advance({ type: "canonical-state-confirmed" });
          if (operation === "approve") {
            const refreshed = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) });
             if (refreshed.ok) { setOrder(await refreshed.json() as BuyerOrderResponse); }
          }
          break;
        }
        if (next.confirmationStatus === "reverted" || attempt === 5) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
      }
    } finally { setConfirming(false); }
  }
  async function submit(operation: BuyerOperation, intent: JsonIntent) {
    setOperation(operation, { type: "start-submit" });
    let submitted = false;
    try {
      const submission = await submitBuyerTransaction(executableIntent(intent), provider());
      setResult(submission);
      setOperation(operation, { type: "submission-returned-hash", transactionHash: submission.hash });
      submitted = true;
      setConfirmation(null);
      await confirm(operation, submission.hash);
    } catch (cause) {
      if (!submitted) setOperation(operation, { type: "submission-failed" });
      throw cause;
    }
  }

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
      <input id="orderId" value={orderId} onChange={(event) => { setOrderId(event.target.value); setOrder(null); setResult(null); setApproveOperation(createBuyerOperation("", "approve")); setFundOperation(createBuyerOperation("", "fund")); }} placeholder="0x…" />
       <button onClick={() => run(async () => { const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const body = await response.json() as BuyerOrderResponse | { error?: { message?: string } }; if (!response.ok) throw new Error("error" in body && body.error?.message ? body.error.message : "Unable to load order"); setOrder(body as BuyerOrderResponse); setApproveOperation(createBuyerOperation(orderId, "approve")); setFundOperation(createBuyerOperation(orderId, "fund")); })}>Load order</button>
      {order && <><dl><dt>Buyer</dt><dd>{order.buyer}</dd><dt>Amount</dt><dd>{order.amount.usdc} USDC ({order.amount.baseUnits} base units)</dd><dt>Status</dt><dd>{order.statusLabel}</dd><dt>Deadline</dt><dd>{order.fundingDeadline} ({order.fundingDeadlineOpen ? "open" : "expired"})</dd><dt>Allowance</dt><dd>{order.allowance.usdc} USDC ({order.allowance.baseUnits} base units)</dd></dl>
      <IntentPreview title="Approve operation preview" intent={order.approveIntent} />
       <button disabled={!actionState?.approve.available} onClick={() => run(() => submit("approve", order.approveIntent))}>Approve</button>
      <IntentPreview title="Fund operation preview" intent={order.fundIntent} />
        <button disabled={!actionState?.fund.available} onClick={() => run(() => submit("fund", order.fundIntent))}>Fund</button>
       {actionState && <p>{actionState.lifecycleMessage}</p>}
       {actionState && !actionState.approve.available && actionState.primaryBuyerAction !== "fund" && <p>{actionState.approve.message}</p>}
      <button className="secondary" onClick={() => run(async () => { const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const body = await response.json() as BuyerOrderResponse; if (!response.ok) throw new Error("Unable to refresh order"); setOrder(body); })}>Refresh order state</button></>}
    </section>
    {result && <section><h2>{confirming ? "Submitted — not confirmed" : "Transaction confirmation"}</h2><a href={getExplorerTransactionUrl(result.hash as `0x${string}`)} target="_blank" rel="noreferrer">{result.hash}</a>{confirmation && <><p>{confirmation.confirmationStatus}</p>{confirmation.orderStatus && <p>Canonical order status: {confirmation.orderStatus}{confirmation.operation === "fund-order" && confirmation.stateConfirmed ? " — funded, not settled" : ""}</p>}{confirmation.allowance && <p>Allowance: {confirmation.allowance} / {confirmation.requiredAmount}</p>}<p>{confirmation.stateConfirmed ? "On-chain state confirmed" : "Receipt alone is not success"}</p><button className="secondary" disabled={confirming} onClick={() => run(() => confirm(confirmation.operation === "approve-usdc" ? "approve" : "fund", confirmation.transactionHash))}>Retry confirmation</button></>}</section>}
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}

function IntentPreview({ title, intent }: { title: string; intent: JsonIntent }) { return <div className="preview"><strong>{title}</strong><span>{intent.summary}</span><code>chain {intent.chainId}</code><code>from {intent.from}</code><code>to {intent.to}</code><code>data {intent.data}</code></div>; }