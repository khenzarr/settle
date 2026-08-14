import assert from "node:assert/strict";
import test from "node:test";

import { MerchantPaymentIntentError } from "@settle/db/payment-intent-service";
import { merchantApiError, readBoundedJson, requireEmptyActivationBody } from "./http.server.ts";

test("reads bounded JSON and rejects non-JSON or oversized bodies", async () => {
  assert.deepEqual(await readBoundedJson(new Request("https://settle.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: true }) })), { ok: true });
  await assert.rejects(readBoundedJson(new Request("https://settle.test/api", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), (error) => error instanceof MerchantPaymentIntentError && error.code === "invalid_content_type");
  await assert.rejects(readBoundedJson(new Request("https://settle.test/api", { method: "POST", headers: { "content-type": "application/json", "content-length": String(33 * 1024) }, body: "{}" })), (error) => error instanceof MerchantPaymentIntentError && error.code === "request_body_too_large");
});

test("activation accepts only an absent body or an empty JSON object", async () => {
  await requireEmptyActivationBody(new Request("https://settle.test/api", { method: "POST" }));
  await requireEmptyActivationBody(new Request("https://settle.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  await assert.rejects(requireEmptyActivationBody(new Request("https://settle.test/api", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ execute: true }) })), (error) => error instanceof MerchantPaymentIntentError && error.code === "activation_body_not_allowed");
});

test("uniform API errors include a request ID without leaking cause details", async () => {
  const response = merchantApiError(new MerchantPaymentIntentError(409, "idempotency_key_reused", "conflict", "Idempotency-Key"), "req_test");
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: { type: "invalid_request_error", code: "idempotency_key_reused", message: "conflict", param: "Idempotency-Key" }, request_id: "req_test" });
});
