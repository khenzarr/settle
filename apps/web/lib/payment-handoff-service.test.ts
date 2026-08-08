import assert from "node:assert/strict";
import test from "node:test";

import { OrderStatus, createMarketplaceOrderPlan, type SettlementOrderProjection } from "@settle/shared";
import { loadPaymentHandoff } from "./payment-handoff-service.server.ts";
import { MarketplaceOrderServiceError } from "./payment-intent-service.server.ts";
import { parsePublicAppOrigin, PublicAppOriginError } from "./public-app-origin.server.ts";

test("validates and normalizes only explicitly configured public origins", () => {
  assert.equal(parsePublicAppOrigin({ SETTLE_PUBLIC_APP_ORIGIN: " https://settle.example/ " }), "https://settle.example");
  assert.equal(parsePublicAppOrigin({ SETTLE_PUBLIC_APP_ORIGIN: "https://SETTLE.example:443" }), "https://settle.example");
  assert.equal(parsePublicAppOrigin({ SETTLE_PUBLIC_APP_ORIGIN: "http://localhost:3000" }, { allowInsecureLocalhost: true }), "http://localhost:3000");
  for (const value of [undefined, "http://settle.example", "http://localhost:3000", "ftp://settle.example", "https://user:pass@settle.example", "https://settle.example/path", "https://settle.example?x=1", "https://settle.example#x", "https://*.settle.example"]) {
    assert.throws(() => parsePublicAppOrigin({ SETTLE_PUBLIC_APP_ORIGIN: value }), (error: unknown) => error instanceof PublicAppOriginError && error.code === "PUBLIC_ORIGIN_UNAVAILABLE");
  }
  assert.throws(() => parsePublicAppOrigin({ HOST: "attacker.example", X_FORWARDED_HOST: "attacker.example", X_FORWARDED_PROTO: "https", REQUEST_ORIGIN: "https://attacker.example" }), (error: unknown) => error instanceof PublicAppOriginError);
});

const plan = createMarketplaceOrderPlan({ externalOrderId: "handoff-service", buyer: "0x1111111111111111111111111111111111111111", amountUsdc: "42.50", fundingDeadline: "2000", settlementDeadline: "3000", settlement: [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 10000 }] });
const projection: SettlementOrderProjection = { orderId: plan.order.orderId, exists: true, buyer: plan.order.buyer, totalAmountBaseUnits: 42500000n, totalAmountUsdc: "42.50", fundingDeadline: 2000n, settlementDeadline: 3000n, termsHash: plan.order.termsHash, createdAt: 1000n, fundedAt: 0n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, timestamps: { createdAt: 1000n, fundedAt: null, disputedAt: null, settledAt: null, refundedAt: null, cancelledAt: null }, rawStatus: OrderStatus.Created, status: OrderStatus.Created, statusLabel: "Created", settlementRecipients: [plan.order.settlement[0]!.recipient], settlementSharesBps: [10000], expectedPayouts: [{ recipient: plan.order.settlement[0]!.recipient, shareBps: 10000, expectedPayoutBaseUnits: 42500000n, expectedPayoutUsdc: "42.50" }], isCreated: true, isFunded: false, isDisputed: false, isTerminal: false, carriesActiveEscrow: false, explorer: { settlementEscrowAddress: "", buyerAddress: "", usdcToken: "" } };
const dependencies = { readOrder: async () => ({ kind: "known" as const, projection }), readEvidence: async () => { throw new Error("optional evidence unavailable"); }, now: () => 1500n };

test("loads handoff through canonical Payment Intent without request-origin fallbacks", async () => {
  const handoff = await loadPaymentHandoff(plan.order.orderId, dependencies, { SETTLE_PUBLIC_APP_ORIGIN: "https://pay.settle.example" });
  assert.equal(handoff.checkout.url, `https://pay.settle.example/pay/${plan.order.orderId}`); assert.equal(handoff.qr.payload, handoff.checkout.url);
  assert.equal(handoff.handoff.paymentActionAvailable, true); assert.equal(handoff.amount.usdc, "42.50"); assert.equal(handoff.buyer, plan.order.buyer);
  const serialized = JSON.stringify(handoff); for (const forbidden of ["headers", "forwarded", "request", "calldata", "idempotency", "rpcUrl", "walletId"]) assert.equal(serialized.includes(forbidden), false);
});

test("fails handoff safely when origin is missing while preserving canonical read errors", async () => {
  await assert.rejects(() => loadPaymentHandoff(plan.order.orderId, dependencies, {}), (error: unknown) => error instanceof PublicAppOriginError);
  await assert.rejects(() => loadPaymentHandoff("bad", dependencies, { SETTLE_PUBLIC_APP_ORIGIN: "https://settle.example" }), (error: unknown) => error instanceof MarketplaceOrderServiceError && error.code === "invalid-order-id");
  await assert.rejects(() => loadPaymentHandoff(plan.order.orderId, { ...dependencies, readOrder: async () => ({ kind: "unknown" as const }) }, { SETTLE_PUBLIC_APP_ORIGIN: "https://settle.example" }), (error: unknown) => error instanceof MarketplaceOrderServiceError && error.code === "unknown-order");
});