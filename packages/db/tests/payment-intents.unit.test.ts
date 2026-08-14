import assert from "node:assert/strict";
import test from "node:test";

import { MerchantPaymentIntentError, validateIdempotencyKey } from "../src/payment-intent-service.ts";
import { PersistentRateLimitService } from "../src/rate-limit-service.ts";

test("accepts bounded printable idempotency keys", () => {
  assert.equal(validateIdempotencyKey("checkout:order-42/retry-1"), "checkout:order-42/retry-1");
  assert.equal(validateIdempotencyKey("x".repeat(255)).length, 255);
});

test("rejects missing, oversized, whitespace, and control-character idempotency keys", () => {
  for (const value of [null, "", "contains space", "line\nbreak", "x".repeat(256)]) {
    assert.throws(() => validateIdempotencyKey(value), (error) => error instanceof MerchantPaymentIntentError && error.code === "invalid_idempotency_key" && error.status === 400);
  }
});

test("persistent rate limiting fails closed without a strong digest key", () => {
  assert.throws(() => new PersistentRateLimitService({} as never, "short"), /at least 32 bytes/);
});
