import assert from "node:assert/strict";
import { test } from "node:test";
import { OrderStatus } from "@settle/shared";
import { projectOrderActionState } from "./order-action-state.ts";

const input = (patch: Partial<Parameters<typeof projectOrderActionState>[0]> = {}) => ({ status: OrderStatus.Created, buyer: "0xAbC0000000000000000000000000000000000001", connectedAccount: "0xabc0000000000000000000000000000000000001", fundingDeadlineOpen: true, allowance: 0n, requiredAmount: 100n, ...patch });

test("Created disconnected and wrong wallet fail closed", () => {
  assert.equal(projectOrderActionState(input({ connectedAccount: null })).approve.reasonCode, "wallet-disconnected");
  assert.equal(projectOrderActionState(input({ connectedAccount: "0x0000000000000000000000000000000000000002" })).connectedRole, "other");
  assert.equal(projectOrderActionState(input({ connectedAccount: "0x0000000000000000000000000000000000000002" })).fund.reasonCode, "wrong-buyer-account");
});
test("buyer allowance selects approval only when insufficient", () => {
  for (const allowance of [0n, 99n]) { const state = projectOrderActionState(input({ allowance })); assert.equal(state.primaryBuyerAction, "approve"); assert.equal(state.approve.available, true); assert.equal(state.fund.available, false); }
  for (const allowance of [100n, 101n]) { const state = projectOrderActionState(input({ allowance })); assert.equal(state.primaryBuyerAction, "fund"); assert.equal(state.approve.reasonCode, "already-approved"); assert.equal(state.approve.available, false); assert.equal(state.fund.available, true); }
});
test("closed Created order cannot be funded and has no escrow liability", () => { const state = projectOrderActionState(input({ fundingDeadlineOpen: false })); assert.equal(state.approve.reasonCode, "funding-deadline-closed"); assert.equal(state.fund.available, false); assert.equal(state.hasActiveEscrow, false); });
test("Funded and Disputed suppress buyer funding and expose workflows", () => { const funded = projectOrderActionState(input({ status: OrderStatus.Funded })); assert.equal(funded.hasActiveEscrow, true); assert.equal(funded.workflow, "buyer-or-operator"); assert.equal(funded.fund.available, false); const disputed = projectOrderActionState(input({ status: OrderStatus.Disputed })); assert.equal(disputed.workflow, "arbitrator"); assert.equal(disputed.approve.reasonCode, "order-disputed"); });
test("terminal statuses suppress all funding and distinguish cancellation", () => { for (const status of [OrderStatus.Completed, OrderStatus.Refunded, OrderStatus.Cancelled]) { const state = projectOrderActionState(input({ status })); assert.equal(state.isTerminal, true); assert.equal(state.approve.reasonCode, "order-terminal"); assert.equal(state.fund.available, false); if (status === OrderStatus.Cancelled) assert.match(state.lifecycleMessage, /not a refund/); } });
test("unknown status is explicitly unsupported and fail closed", () => { const state = projectOrderActionState(input({ status: 99 })); assert.equal(state.phase, "unknown"); assert.equal(state.primaryBuyerAction, "none"); assert.equal(state.fund.reasonCode, "unsupported-status"); });
test("address comparison is normalized safely", () => { assert.equal(projectOrderActionState(input({ buyer: "  0xABC0000000000000000000000000000000000001  " })).connectedRole, "buyer"); });
test("no funding action is exposed after Created", () => { for (const status of [OrderStatus.Funded, OrderStatus.Disputed, OrderStatus.Completed, OrderStatus.Refunded, OrderStatus.Cancelled]) assert.equal(projectOrderActionState(input({ status })).primaryBuyerAction, "none"); });