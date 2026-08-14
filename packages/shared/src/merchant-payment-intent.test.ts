import assert from "node:assert/strict";
import test from "node:test";

import { canonicalMerchantPaymentIntentRequest, normalizeMerchantPaymentIntentCreate } from "./merchant-payment-intent.ts";

const now = new Date("2030-01-01T00:00:00.000Z");
const base = {
  external_order_id: "cart-42",
  buyer: "0x1111111111111111111111111111111111111111",
  amount: "42.500000",
  currency: "USDC" as const,
  funding_deadline: "2030-01-02T00:00:00.000Z",
  settlement_deadline: "2030-01-08T00:00:00.000Z",
  settlement_recipients: [
    { address: "0x2222222222222222222222222222222222222222", share_bps: 7000 },
    { address: "0x3333333333333333333333333333333333333333", share_bps: 3000 },
  ],
};

test("normalizes merchant input and preserves the canonical marketplace identity", () => {
  const normalized = normalizeMerchantPaymentIntentCreate({ ...base, metadata: { z: true, a: "first" } }, now);
  assert.equal(normalized.amount, "42.5");
  assert.equal(normalized.plan.order.amount.baseUnits, "42500000");
  assert.match(normalized.plan.order.orderId, /^0x[0-9a-f]{64}$/);
  assert.match(normalized.plan.order.termsHash, /^0x[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(normalized.metadata), ["a", "z"]);
});

test("canonical request fingerprint input is stable across metadata key order and amount formatting", () => {
  const left = normalizeMerchantPaymentIntentCreate({ ...base, metadata: { z: true, a: "first" } }, now);
  const right = normalizeMerchantPaymentIntentCreate({ ...base, amount: "42.5", metadata: { a: "first", z: true } }, now);
  assert.equal(canonicalMerchantPaymentIntentRequest(left), canonicalMerchantPaymentIntentRequest(right));
});

test("rejects unknown fields, invalid split totals, and unsafe deadline bounds", () => {
  assert.throws(() => normalizeMerchantPaymentIntentCreate({ ...base, execute: true }, now));
  assert.throws(() => normalizeMerchantPaymentIntentCreate({ ...base, settlement_recipients: [{ ...base.settlement_recipients[0], share_bps: 9000 }] }, now));
  assert.throws(() => normalizeMerchantPaymentIntentCreate({ ...base, funding_deadline: "2029-12-31T23:59:59.000Z" }, now));
});
