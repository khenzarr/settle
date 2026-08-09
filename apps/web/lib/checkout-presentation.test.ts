import assert from "node:assert/strict";
import test from "node:test";
import { getCheckoutPresentation } from "./checkout-presentation.ts";

const states = ["planned", "awaiting-payment", "payment-window-expired", "funded", "disputed", "completed", "refunded", "cancelled"] as const;

test("keeps every canonical payment presentation state semantically distinct", () => {
  const presentations = states.map((paymentState) => getCheckoutPresentation({ paymentState }));
  assert.equal(new Set(presentations.map(({ headline }) => headline)).size, states.length);
  for (const presentation of presentations) {
    assert.ok(presentation.description.length > 0);
    assert.ok(presentation.eyebrow.length > 0);
  }
});

test("preserves payment-state boundaries in presentation", () => {
  assert.match(getCheckoutPresentation({ paymentState: "payment-window-expired" }).description, /canonical order status remains authoritative/);
  assert.doesNotMatch(getCheckoutPresentation({ paymentState: "payment-window-expired" }).headline, /cancel/i);
  assert.equal(getCheckoutPresentation({ paymentState: "planned" }).actionOrientation, "create-required");
  assert.equal(getCheckoutPresentation({ paymentState: "awaiting-payment" }).actionOrientation, "payable");
  assert.equal(getCheckoutPresentation({ paymentState: "funded" }).actionOrientation, "informational");
  assert.doesNotMatch(getCheckoutPresentation({ paymentState: "funded" }).description, /fund again|pay again/i);
  assert.equal(getCheckoutPresentation({ paymentState: "disputed" }).tone, "warning");
  assert.doesNotMatch(getCheckoutPresentation({ paymentState: "disputed" }).description, /failure|failed/i);
  for (const paymentState of ["completed", "refunded", "cancelled"] as const) assert.equal(getCheckoutPresentation({ paymentState }).actionOrientation, "resolved");
});