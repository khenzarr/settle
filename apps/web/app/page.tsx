"use client";

import { useState } from "react";
import { ARC_TESTNET, OrderStatus, getExplorerTransactionUrl } from "@settle/shared";
import { connectWallet, submitBuyerTransaction, switchToArcTestnet, type Eip1193Provider, type WalletState } from "../lib/buyer-wallet-adapter";
import type { BuyerOrderResponse, JsonIntent } from "../lib/buyer-order-intent-service";
import type { BuyerConfirmationResponse } from "../lib/buyer-transaction-confirmation";
import { composeBuyerOperationState, projectOrderActionState } from "../lib/order-action-state";
import { createBuyerOperation, projectBuyerOperation, restoreBuyerOperation, transitionBuyerOperation, type BuyerOperation, type BuyerOperationRecord } from "../lib/buyer-transaction-progress";
import { clearBuyerOperationRecovery, readBuyerOperationRecovery, recoveryFromOperation, writeBuyerOperationRecovery } from "../lib/buyer-operation-recovery-storage";

declare global { interface Window { ethereum?: Eip1193Provider } }
function executableIntent(intent: JsonIntent) { return { ...intent, value: 0n } as never; }
function shortHash(hash: string): string { return `${hash.slice(0, 10)}…${hash.slice(-8)}`; }
function publicMessage(cause: unknown): string { if (cause instanceof Error && (cause.message.includes("does not exist") || cause.message === "Transaction exists. Check its current onchain state.")) return cause.message; return "Submission could not be confirmed. Review before trying again."; }

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ account: null, chainId: null });
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<BuyerOrderResponse | null>(null);
  const [approveOperation, setApproveOperation] = useState<BuyerOperationRecord>(() => createBuyerOperation("", "approve"));
  const [fundOperation, setFundOperation] = useState<BuyerOperationRecord>(() => createBuyerOperation("", "fund"));
  const [confirmation, setConfirmation] = useState<BuyerConfirmationResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const operationRecord = approveOperation.progress !== "idle" ? approveOperation : fundOperation;
  const operationState = projectBuyerOperation(operationRecord);
  const actionState = order ? composeBuyerOperationState(projectOrderActionState({ status: Number(order.status), buyer: order.buyer, connectedAccount: wallet.account, fundingDeadlineOpen: order.fundingDeadlineOpen, allowance: BigInt(order.allowance.baseUnits), requiredAmount: BigInt(order.amount.baseUnits) }), operationState) : null;
  const provider = () => { if (!window.ethereum) throw new Error("No injected EVM wallet found"); return window.ethereum; };
  async function run(action: () => Promise<void>) { setError(""); try { await action(); } catch (cause) { setError(publicMessage(cause)); } }
  function store(record: BuyerOperationRecord) { const recovery = recoveryFromOperation(record); if (recovery) writeBuyerOperationRecovery(recovery); else if (record.progress === "state-confirmed" || record.progress === "reverted") clearBuyerOperationRecovery(record.orderId, record.operation); }
  function restore(orderKey: string, operation: BuyerOperation): BuyerOperationRecord { const stored = readBuyerOperationRecovery(orderKey, operation); return stored ? restoreBuyerOperation(stored.orderId, stored.operation, stored.transactionHash, stored.progress) : createBuyerOperation(orderKey, operation); }
  async function readOrder(): Promise<BuyerOrderResponse> { const response = await fetch("/api/buyer/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) }); const body = await response.json() as BuyerOrderResponse | { error?: { message?: string } }; if (!response.ok) throw new Error("error" in body && body.error?.message ? body.error.message : "Unable to load order state"); return body as BuyerOrderResponse; }
  function reconcileCanonical(next: BuyerOrderResponse) { if (next.status !== String(OrderStatus.Created)) { clearBuyerOperationRecovery(orderId, "approve"); clearBuyerOperationRecovery(orderId, "fund"); setApproveOperation(createBuyerOperation(orderId, "approve")); setFundOperation(createBuyerOperation(orderId, "fund")); } else if (BigInt(next.allowance.baseUnits) >= BigInt(next.amount.baseUnits)) { clearBuyerOperationRecovery(orderId, "approve"); setApproveOperation(createBuyerOperation(orderId, "approve")); } }
  async function refreshOrder() { const next = await readOrder(); setOrder(next); reconcileCanonical(next); }
  async function load() { const next = await readOrder(); setOrder(next); setConfirmation(null); if (next.status !== String(OrderStatus.Created)) { clearBuyerOperationRecovery(orderId, "approve"); clearBuyerOperationRecovery(orderId, "fund"); setApproveOperation(createBuyerOperation(orderId, "approve")); setFundOperation(createBuyerOperation(orderId, "fund")); } else { const approvalComplete = BigInt(next.allowance.baseUnits) >= BigInt(next.amount.baseUnits); if (approvalComplete) clearBuyerOperationRecovery(orderId, "approve"); setApproveOperation(approvalComplete ? createBuyerOperation(orderId, "approve") : restore(orderId, "approve")); setFundOperation(restore(orderId, "fund")); } }
  async function confirm(operation: BuyerOperation, hash: string, poll = true, initial?: BuyerOperationRecord) {
    let current = initial ?? (operation === "approve" ? approveOperation : fundOperation);
    if (current.progress === "confirmation-error") current = transitionBuyerOperation(current, { type: "retry-confirmation" });
    const advance = (event: Parameters<typeof transitionBuyerOperation>[1]) => { current = transitionBuyerOperation(current, event); (operation === "approve" ? setApproveOperation : setFundOperation)(current); store(current); };
    setConfirming(true);
    try {
      for (let attempt = 0; attempt < (poll ? 6 : 1); attempt += 1) {
        const response = await fetch("/api/buyer/transaction/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, transactionHash: hash, operation: operation === "approve" ? "approve-usdc" : "fund-order" }) });
        const body = await response.json() as BuyerConfirmationResponse | { error?: { message?: string } };
        if (!response.ok) { if (current.progress === "pending-receipt" || current.progress === "included-awaiting-state") advance({ type: "confirmation-failed" }); throw new Error("Transaction exists. Check its current onchain state."); }
        const next = body as BuyerConfirmationResponse; setConfirmation(next);
        if (next.confirmationStatus === "reverted" && current.progress === "pending-receipt") advance({ type: "receipt-reverted" });
        if (next.confirmationStatus === "included-awaiting-state" && current.progress === "pending-receipt") advance({ type: "receipt-included" });
        if (next.confirmationStatus === "state-confirmed") { if (current.progress === "pending-receipt") advance({ type: "receipt-included" }); if (current.progress === "included-awaiting-state") advance({ type: "canonical-state-confirmed" }); clearBuyerOperationRecovery(orderId, operation); await refreshOrder(); break; }
        if (next.confirmationStatus === "reverted" || attempt === (poll ? 5 : 0)) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
      }
    } finally { setConfirming(false); }
  }
  async function submit(operation: BuyerOperation, intent: JsonIntent) { const setter = operation === "approve" ? setApproveOperation : setFundOperation; const base = operation === "approve" ? approveOperation : fundOperation; const submitting = transitionBuyerOperation(base, { type: "start-submit" }); setter(submitting); let submitted = false; try { const result = await submitBuyerTransaction(executableIntent(intent), provider()); const pending = transitionBuyerOperation(submitting, { type: "submission-returned-hash", transactionHash: result.hash }); setter(pending); store(pending); submitted = true; setConfirmation(null); await confirm(operation, result.hash, true, pending); } catch (cause) { if (!submitted) setter(transitionBuyerOperation(submitting, { type: "submission-failed" })); throw cause; } }

  return <main><p className="eyebrow">D4B buyer execution proof</p><h1>Settle wallet adapter</h1><p>The server reads canonical on-chain state and prepares read-only buyer intent previews. This browser never reconstructs calldata.</p>
    <section><h2>Wallet</h2><button onClick={() => run(async () => setWallet(await connectWallet(provider())))}>Connect wallet</button><dl><dt>Address</dt><dd>{wallet.account ?? "Not connected"}</dd><dt>Chain</dt><dd>{wallet.chainId ?? "Unknown"}{wallet.chainId === ARC_TESTNET.chainId ? " — Arc Testnet" : ""}</dd></dl>{wallet.chainId !== null && wallet.chainId !== ARC_TESTNET.chainId && <button className="secondary" onClick={() => run(async () => { await switchToArcTestnet(provider()); setWallet(await connectWallet(provider())); })}>Switch to Arc Testnet</button>}</section>
    <section><h2>Order-backed buyer intent</h2><label htmlFor="orderId">Order ID (bytes32)</label><input id="orderId" value={orderId} onChange={(event) => { setOrderId(event.target.value); setOrder(null); setConfirmation(null); setApproveOperation(createBuyerOperation("", "approve")); setFundOperation(createBuyerOperation("", "fund")); }} placeholder="0x…" /><button onClick={() => run(load)}>Load order</button>{order && <OrderDetails order={order} actionState={actionState} approveOperation={approveOperation} fundOperation={fundOperation} onSubmit={(operation, intent) => run(() => submit(operation, intent))} onRefresh={() => run(refreshOrder)} />}</section>
    {order && operationRecord.progress !== "idle" && <OperationStatus state={operationState} onRecover={() => run(() => confirm(operationRecord.operation, operationRecord.transactionHash!, false))} confirming={confirming} />}
    {confirmation && <p>Latest read-only check: {confirmation.stateConfirmed ? "Onchain state confirmed" : "Receipt or hash alone is not success"}.</p>}{error && <p className="error" role="alert">{error}</p>}
  </main>;
}

function OperationStatus({ state, onRecover, confirming }: { state: ReturnType<typeof projectBuyerOperation>; onRecover: () => void; confirming: boolean }) { return <section><h2>Buyer operation: {state.operation}</h2><p><strong>{state.statusLabel}</strong> — {state.statusMessage}</p>{state.transactionHash && <><p>Public transaction: <code>{shortHash(state.transactionHash)}</code></p><a href={getExplorerTransactionUrl(state.transactionHash)} target="_blank" rel="noreferrer">View on ArcScan</a><p>Explorer visibility is not confirmation of finality.</p></>}{state.recovery === "confirm-existing" && <button className="secondary" disabled={confirming} onClick={onRecover}>{confirming ? "Checking transaction…" : "Check transaction"}</button>}{state.recovery === "manual-review" && <p>Review the existing transaction. No replacement transaction will be submitted automatically.</p>}</section>; }
function OrderDetails({ order, actionState, approveOperation, fundOperation, onSubmit, onRefresh }: { order: BuyerOrderResponse; actionState: ReturnType<typeof projectOrderActionState> | null; approveOperation: BuyerOperationRecord; fundOperation: BuyerOperationRecord; onSubmit: (operation: BuyerOperation, intent: JsonIntent) => void; onRefresh: () => void }) { const created = order.status === String(OrderStatus.Created); return <><dl><dt>Buyer</dt><dd>{order.buyer}</dd><dt>Amount</dt><dd>{order.amount.usdc} USDC ({order.amount.baseUnits} base units)</dd><dt>Status</dt><dd>{order.statusLabel}</dd><dt>Deadline</dt><dd>{order.fundingDeadline} ({order.fundingDeadlineOpen ? "open" : "expired"})</dd><dt>Allowance</dt><dd>{order.allowance.usdc} USDC ({order.allowance.baseUnits} base units)</dd></dl>{created && <><IntentPreview title="Approve operation preview" intent={order.approveIntent} /><button disabled={!actionState?.approve.available || !projectBuyerOperation(approveOperation).submitAllowed} onClick={() => onSubmit("approve", order.approveIntent)}>Approve</button><IntentPreview title="Fund operation preview" intent={order.fundIntent} /><button disabled={!actionState?.fund.available || !projectBuyerOperation(fundOperation).submitAllowed} onClick={() => onSubmit("fund", order.fundIntent)}>Fund</button></>}<p>{actionState?.lifecycleMessage}</p><button className="secondary" onClick={onRefresh}>Refresh order state</button></>; }
function IntentPreview({ title, intent }: { title: string; intent: JsonIntent }) { return <div className="preview"><strong>{title}</strong><span>{intent.summary}</span><code>chain {intent.chainId}</code><code>from {intent.from}</code><code>to {intent.to}</code><code>data {intent.data}</code></div>; }