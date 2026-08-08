import assert from "node:assert/strict";
import test from "node:test";

import { ARC_TESTNET, OrderStatus, checkoutPath, createMarketplaceOrderPlan, projectMarketplaceOrder, projectOnchainPaymentIntent } from "./index.ts";
import type { SettlementOrderProjection } from "./settlement-read.ts";

const request = {
  externalOrderId: "FOOD-4250", buyer: "0x1111111111111111111111111111111111111111", amountUsdc: "42.500001", fundingDeadline: "2000", settlementDeadline: "3000",
  settlement: [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 10000 }],
};
const plan = createMarketplaceOrderPlan(request);

function projection(status: number): SettlementOrderProjection {
  const label = ["None", "Created", "Funded", "Disputed", "Completed", "Refunded", "Cancelled"][status]!;
  return {
    orderId: plan.order.orderId, exists: true, buyer: plan.order.buyer, totalAmountBaseUnits: 42500001n, totalAmountUsdc: "42.500001",
    fundingDeadline: 2000n, settlementDeadline: 3000n, termsHash: plan.order.termsHash, createdAt: 1000n,
    fundedAt: status >= OrderStatus.Funded && status !== OrderStatus.Cancelled ? 1500n : 0n, disputedAt: status === OrderStatus.Disputed ? 1600n : 0n,
    settledAt: status === OrderStatus.Completed ? 1700n : 0n, refundedAt: status === OrderStatus.Refunded ? 1700n : 0n, cancelledAt: status === OrderStatus.Cancelled ? 2100n : 0n,
    timestamps: { createdAt: 1000n, fundedAt: null, disputedAt: null, settledAt: null, refundedAt: null, cancelledAt: null }, rawStatus: status, status: status as never, statusLabel: label,
    settlementRecipients: [request.settlement[0].recipient as never], settlementSharesBps: [10000], expectedPayouts: [{ ...request.settlement[0], recipient: request.settlement[0].recipient as never, expectedPayoutBaseUnits: 42500001n, expectedPayoutUsdc: "42.500001" }],
    isCreated: status === OrderStatus.Created, isFunded: status === OrderStatus.Funded, isDisputed: status === OrderStatus.Disputed,
    isTerminal: status >= OrderStatus.Completed, carriesActiveEscrow: status === OrderStatus.Funded || status === OrderStatus.Disputed,
    explorer: { settlementEscrowAddress: "", buyerAddress: "", usdcToken: "" },
  };
}

function intent(status: number, now = 1500n, warning?: string) {
  return projectOnchainPaymentIntent(projectMarketplaceOrder({ order: projection(status), now, ...(warning ? { evidenceWarning: warning } : {}) }), now);
}

test("planned intent reuses deterministic order identity and remains unavailable", () => {
  assert.equal(plan.paymentIntent.orderId, plan.order.orderId);
  assert.equal(plan.paymentIntent.source, "plan");
  assert.equal(plan.paymentIntent.canonicalStatus, "None");
  assert.equal(plan.paymentIntent.paymentState, "planned");
  assert.deepEqual(plan.paymentIntent.checkout, { pageAvailable: false, paymentActionAvailable: false, reason: "marketplace-create-required" });
  assert.equal(plan.paymentIntent.externalOrderId, request.externalOrderId);
  assert.equal("id" in plan.paymentIntent, false);
});

test("Created maps deadline boundary without changing canonical status", () => {
  const open = intent(OrderStatus.Created, 1999n);
  assert.equal(open.paymentState, "awaiting-payment"); assert.equal(open.checkout.paymentActionAvailable, true);
  assert.equal(open.checkout.path, `/pay/${plan.order.orderId}`); assert.equal(open.checkout.path!.startsWith("http"), false);
  for (const now of [2000n, 2001n]) { const expired = intent(OrderStatus.Created, now); assert.equal(expired.canonicalStatus, "Created"); assert.equal(expired.paymentState, "payment-window-expired"); assert.equal(expired.checkout.paymentActionAvailable, false); }
});

test("canonical states preserve exact commerce and settlement data", () => {
  const expected = [[OrderStatus.Funded, "funded"], [OrderStatus.Disputed, "disputed"], [OrderStatus.Completed, "completed"], [OrderStatus.Refunded, "refunded"], [OrderStatus.Cancelled, "cancelled"]] as const;
  for (const [status, state] of expected) { const view = intent(status); assert.equal(view.paymentState, state); assert.equal(view.checkout.pageAvailable, true); assert.equal(view.checkout.paymentActionAvailable, false); }
  const funded = intent(OrderStatus.Funded);
  assert.deepEqual(funded.amount, { baseUnits: "42500001", usdc: "42.500001", currency: "USDC" }); assert.equal(funded.buyer, request.buyer);
  assert.equal(funded.network.chainId, ARC_TESTNET.chainId); assert.equal(funded.network.settlementContract, ARC_TESTNET.settlementEscrow.address);
  assert.equal(funded.settlementSummary[0]!.expectedAmountBaseUnits, "42500001"); assert.equal("externalOrderId" in funded, false);
});

test("evidence degradation remains bounded and canonical state stays authoritative", () => {
  const funded = intent(OrderStatus.Funded, 1500n, "Evidence temporarily unavailable");
  assert.equal(funded.canonicalStatus, "Funded"); assert.equal(funded.paymentState, "funded"); assert.equal(funded.evidence.completeness, "partial"); assert.deepEqual(funded.evidence.warnings, ["Evidence temporarily unavailable"]);
});

test("checkout path validates bytes32 and never derives an origin", () => {
  assert.equal(checkoutPath(plan.order.orderId), `/pay/${plan.order.orderId}`);
  assert.throws(() => checkoutPath("https://attacker.example/pay/order"));
});

test("an onchain Payment Intent rejects a non-existing canonical status", () => {
  assert.throws(() => intent(OrderStatus.None), /existing canonical order/);
});