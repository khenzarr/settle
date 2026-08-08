import assert from "node:assert/strict";
import test from "node:test";

import { OrderStatus, createMarketplaceOrderPlan, projectMarketplaceOrder, projectOnchainPaymentIntent, projectPaymentHandoff } from "./index.ts";
import type { SettlementOrderProjection } from "./settlement-read.ts";

const plan = createMarketplaceOrderPlan({ externalOrderId: "handoff-test", buyer: "0x1111111111111111111111111111111111111111", amountUsdc: "42.500001", fundingDeadline: "2000", settlementDeadline: "3000", settlement: [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 10000 }] });

function intent(status: number, now = 1500n) {
  const statusLabel = ["None", "Created", "Funded", "Disputed", "Completed", "Refunded", "Cancelled"][status]!;
  const projection: SettlementOrderProjection = { orderId: plan.order.orderId, exists: true, buyer: plan.order.buyer, totalAmountBaseUnits: 42500001n, totalAmountUsdc: "42.500001", fundingDeadline: 2000n, settlementDeadline: 3000n, termsHash: plan.order.termsHash, createdAt: 1000n, fundedAt: 0n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, timestamps: { createdAt: 1000n, fundedAt: null, disputedAt: null, settledAt: null, refundedAt: null, cancelledAt: null }, rawStatus: status, status: status as never, statusLabel, settlementRecipients: [plan.order.settlement[0]!.recipient], settlementSharesBps: [10000], expectedPayouts: [{ recipient: plan.order.settlement[0]!.recipient, shareBps: 10000, expectedPayoutBaseUnits: 42500001n, expectedPayoutUsdc: "42.500001" }], isCreated: status === OrderStatus.Created, isFunded: status === OrderStatus.Funded, isDisputed: status === OrderStatus.Disputed, isTerminal: status >= OrderStatus.Completed, carriesActiveEscrow: status === OrderStatus.Funded || status === OrderStatus.Disputed, explorer: { settlementEscrowAddress: "", buyerAddress: "", usdcToken: "" } };
  return projectOnchainPaymentIntent(projectMarketplaceOrder({ order: projection, now }), now);
}

test("projects exactly one canonical HTTPS checkout payload", () => {
  const handoff = projectPaymentHandoff(intent(OrderStatus.Created), "https://settle.example");
  const expected = `https://settle.example/pay/${plan.order.orderId}`;
  assert.equal(handoff.checkout.path, `/pay/${plan.order.orderId}`);
  assert.equal(handoff.checkout.url, expected); assert.equal(handoff.checkout.host, "settle.example");
  assert.equal(handoff.qr.payload, expected); assert.equal(handoff.deeplink.url, expected); assert.equal(handoff.qr.contentType, "text/uri-list");
  assert.equal(handoff.amount.baseUnits, "42500001"); assert.equal(handoff.buyer, plan.order.buyer); assert.equal(handoff.canonicalStatus, "Created");
  assert.equal("externalOrderId" in handoff, false);
  for (const forbidden of ["calldata", "transfer", "recipient=", "walletId", "idempotency", "rpcUrl", "privateKey", "CIRCLE_"]) assert.equal(JSON.stringify(handoff).includes(forbidden), false);
});

test("keeps status handoff available while payment action follows canonical lifecycle", () => {
  const cases = [[OrderStatus.Created, 1500n, true], [OrderStatus.Created, 2000n, false], [OrderStatus.Funded, 1500n, false], [OrderStatus.Disputed, 1500n, false], [OrderStatus.Completed, 1500n, false], [OrderStatus.Refunded, 1500n, false], [OrderStatus.Cancelled, 1500n, false]] as const;
  for (const [status, now, paymentActionAvailable] of cases) {
    const source = intent(status, now); const handoff = projectPaymentHandoff(source, "https://settle.example");
    assert.equal(handoff.handoff.available, true); assert.equal(handoff.handoff.paymentActionAvailable, paymentActionAvailable);
    assert.equal(handoff.paymentState, source.paymentState); assert.equal(handoff.canonicalStatus, source.canonicalStatus);
  }
});

test("rejects planned intents, non-root origins, and injected checkout identities", () => {
  assert.equal(plan.paymentIntent.handoff.available, false); assert.equal(plan.paymentIntent.handoff.reason, "marketplace-create-required");
  assert.throws(() => projectPaymentHandoff(plan.paymentIntent, "https://settle.example"), /existing canonical order/);
  for (const origin of ["https://settle.example/path", "https://settle.example?next=https://evil.example", "https://settle.example#evil", "https://settle.example/"]) {
    assert.throws(() => projectPaymentHandoff(intent(OrderStatus.Created), origin), /validated/);
  }
});