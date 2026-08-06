import assert from "node:assert/strict";
import test from "node:test";
import { CircleIntegrationError, normalizeCircleError } from "./errors.ts";

test("safe error normalization preserves status, Circle code, and request ID only", () => {
  const error = normalizeCircleError({
    message: "Bearer secret-token",
    response: {
      status: 429,
      headers: { "x-request-id": "req-123" },
      data: { code: "rate_limit", message: "CIRCLE_API_KEY=secret" },
    },
  }, "listWallets");
  assert.ok(error instanceof CircleIntegrationError);
  assert.equal(error.message, "Circle operation listWallets failed (status=429, code=rate_limit, requestId=req-123)");
  assert.equal(JSON.stringify(error).includes("secret"), false);
});