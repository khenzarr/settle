import assert from "node:assert/strict";
import test from "node:test";

import { OrderStatus, createMarketplaceOrderPlan, type SettlementOrderProjection } from "@settle/shared";
import { loadPaymentIntent, MarketplaceOrderServiceError } from "./payment-intent-service.server.ts";

const plan = createMarketplaceOrderPlan({ externalOrderId: "checkout-test", buyer: "0x1111111111111111111111111111111111111111", amountUsdc: "42.50", fundingDeadline: "2000", settlementDeadline: "3000", settlement: [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 10000 }] });
const projection: SettlementOrderProjection = { orderId: plan.order.orderId, exists: true, buyer: plan.order.buyer, totalAmountBaseUnits: 42500000n, totalAmountUsdc: "42.50", fundingDeadline: 2000n, settlementDeadline: 3000n, termsHash: plan.order.termsHash, createdAt: 1000n, fundedAt: 0n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, timestamps: { createdAt: 1000n, fundedAt: null, disputedAt: null, settledAt: null, refundedAt: null, cancelledAt: null }, rawStatus: OrderStatus.Created, status: OrderStatus.Created, statusLabel: "Created", settlementRecipients: [plan.order.settlement[0]!.recipient], settlementSharesBps: [10000], expectedPayouts: [{ recipient: plan.order.settlement[0]!.recipient, shareBps: 10000, expectedPayoutBaseUnits: 42500000n, expectedPayoutUsdc: "42.50" }], isCreated: true, isFunded: false, isDisputed: false, isTerminal: false, carriesActiveEscrow: false, explorer: { settlementEscrowAddress: "", buyerAddress: "", usdcToken: "" } };

test("loads a publication-safe Created Payment Intent through the canonical order service", async () => {
  const intent = await loadPaymentIntent(plan.order.orderId, { readOrder: async () => ({ kind: "known", projection }), readEvidence: async () => { throw new Error("provider unavailable"); }, now: () => 1500n });
  assert.equal(intent.source, "onchain"); assert.equal(intent.paymentState, "awaiting-payment"); assert.equal(intent.checkout.path, `/pay/${plan.order.orderId}`);
  assert.equal(intent.evidence.completeness, "partial"); assert.equal("externalOrderId" in intent, false);
  const serialized = JSON.stringify(intent); for (const forbidden of ["walletId", "idempotency", "rpcUrl", "calldata", "CIRCLE_API_KEY"]) assert.equal(serialized.includes(forbidden), false);
});

test("rejects invalid and unknown order identities with bounded service errors", async () => {
  const dependencies = { readOrder: async () => ({ kind: "unknown" as const }), readEvidence: async () => { throw new Error("unused"); }, now: () => 1500n };
  await assert.rejects(() => loadPaymentIntent("bad", dependencies), (error: unknown) => error instanceof MarketplaceOrderServiceError && error.code === "invalid-order-id");
  await assert.rejects(() => loadPaymentIntent(plan.order.orderId, dependencies), (error: unknown) => error instanceof MarketplaceOrderServiceError && error.code === "unknown-order");
});

test("maps canonical RPC failure without a Circle dependency", async () => {
  await assert.rejects(() => loadPaymentIntent(plan.order.orderId, { readOrder: async () => { throw new Error("secret provider detail"); }, readEvidence: async () => { throw new Error("unused"); }, now: () => 1500n }), (error: unknown) => error instanceof MarketplaceOrderServiceError && error.code === "rpc-unavailable" && !error.message.includes("secret"));
});