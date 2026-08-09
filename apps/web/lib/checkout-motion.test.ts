import assert from "node:assert/strict";
import test from "node:test";
import { observeCanonicalState, paymentStateFromCanonicalOrder, shouldAnimateCanonicalTransition } from "./checkout-motion.ts";

test("initial canonical observation does not trigger resolve motion", () => {
  const result = observeCanonicalState({ observedState: null }, "completed");
  assert.equal(result.transition, null);
});

test("same canonical state does not trigger motion", () => {
  const result = observeCanonicalState({ observedState: "funded" }, "funded");
  assert.equal(result.transition, null);
});

test("a later different canonical state triggers motion", () => {
  const result = observeCanonicalState({ observedState: "awaiting-payment" }, "funded");
  assert.deepEqual(result.transition, { from: "awaiting-payment", to: "funded" });
});

test("the newest canonical state supersedes stale motion", () => {
  const first = observeCanonicalState({ observedState: "funded" }, "completed");
  const newest = observeCanonicalState(first.observation, "refunded");
  assert.deepEqual(newest.transition, { from: "completed", to: "refunded" });
  assert.equal(newest.observation.observedState, "refunded");
});

test("a remount starts static again", () => {
  assert.equal(observeCanonicalState({ observedState: null }, "completed").transition, null);
});

test("reduced motion never requires animation", () => {
  const transition = observeCanonicalState({ observedState: "funded" }, "completed").transition;
  assert.equal(shouldAnimateCanonicalTransition(transition, true), false);
  assert.equal(shouldAnimateCanonicalTransition(transition, false), true);
});

test("canonical order projection preserves Created expiry and lifecycle semantics", () => {
  assert.equal(paymentStateFromCanonicalOrder("1", false), "awaiting-payment");
  assert.equal(paymentStateFromCanonicalOrder("1", true), "payment-window-expired");
  assert.deepEqual([2, 3, 4, 5, 6].map((status) => paymentStateFromCanonicalOrder(String(status), false)), ["funded", "disputed", "completed", "refunded", "cancelled"]);
});