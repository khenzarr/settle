import test from "node:test";
import assert from "node:assert/strict";

import { ARC_TESTNET, createMarketplaceOrderPlan, calculateSettlementPayouts, projectMarketplaceOrder } from "./index.ts";
import { OrderStatus } from "./order.ts";
import type { SettlementOrderProjection } from "./settlement-read.ts";

const buyer = "0x1111111111111111111111111111111111111111";
const splits = [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 8200 }, { recipient: "0x3333333333333333333333333333333333333333", shareBps: 800 }, { recipient: "0x4444444444444444444444444444444444444444", shareBps: 1000 }];
const request = { externalOrderId: "DD-928310", buyer, amountUsdc: "42.50", fundingDeadline: "2000", settlementDeadline: "3000", settlement: splits };

function createOrderProjectionFixture(status: typeof OrderStatus.Created | typeof OrderStatus.Funded): SettlementOrderProjection {
  const planned = createMarketplaceOrderPlan(request);
  const isCreated = status === OrderStatus.Created;
  const fundedAt = isCreated ? 0n : 1500n;
  return {
    orderId: planned.order.orderId,
    exists: true,
    buyer: planned.order.buyer,
    totalAmountBaseUnits: 42500000n,
    totalAmountUsdc: "42.50",
    fundingDeadline: 2000n,
    settlementDeadline: 3000n,
    termsHash: planned.order.termsHash,
    createdAt: 1000n,
    fundedAt,
    disputedAt: 0n,
    settledAt: 0n,
    refundedAt: 0n,
    cancelledAt: 0n,
    timestamps: {
      createdAt: 1000n,
      fundedAt: isCreated ? null : fundedAt,
      disputedAt: null,
      settledAt: null,
      refundedAt: null,
      cancelledAt: null,
    },
    rawStatus: status,
    status,
    statusLabel: isCreated ? "Created" : "Funded",
    settlementRecipients: planned.order.settlement.map((split) => split.recipient),
    settlementSharesBps: planned.order.settlement.map((split) => split.shareBps),
    expectedPayouts: planned.order.settlement.map((split) => ({
      recipient: split.recipient,
      shareBps: split.shareBps,
      expectedPayoutBaseUnits: BigInt(split.expectedAmountBaseUnits!),
      expectedPayoutUsdc: split.expectedAmountUsdc!,
    })),
    isCreated,
    isFunded: !isCreated,
    isDisputed: false,
    isTerminal: false,
    carriesActiveEscrow: !isCreated,
    explorer: {
      settlementEscrowAddress: "",
      buyerAddress: "",
      usdcToken: "",
    },
  };
}

test("plans a deterministic publication-safe marketplace order", () => {
  const first = createMarketplaceOrderPlan(request);
  const second = createMarketplaceOrderPlan({ ...request });
  assert.equal(first.mode, "plan");
  assert.equal(first.executionAvailable, false);
  assert.deepEqual(first.order, second.order);
  assert.equal(first.order.amount.baseUnits, "42500000");
  assert.equal(first.order.settlement[2]!.expectedAmountBaseUnits, "4250000");
  assert.equal(first.network.chainId, ARC_TESTNET.chainId);
  assert.equal("calldata" in first, false);
});

test("rejects money, identity, split, deadline, and dangerous input violations", () => {
  for (const amountUsdc of ["0", "-1", "1e3", "1.1234567"]) assert.throws(() => createMarketplaceOrderPlan({ ...request, amountUsdc }));
  assert.throws(() => createMarketplaceOrderPlan({ ...request, externalOrderId: " " }));
  assert.throws(() => createMarketplaceOrderPlan({ ...request, settlementDeadline: "2000" }));
  assert.throws(() => createMarketplaceOrderPlan({ ...request, execute: true }));
  assert.throws(() => createMarketplaceOrderPlan({ ...request, target: buyer }));
  assert.throws(() => createMarketplaceOrderPlan({ ...request, settlement: [{ ...splits[0], shareBps: 9999 }] }));
});

test("projects exact deadline actions and protocol-only privileged actions", () => {
  const funded = projectMarketplaceOrder({ order: createOrderProjectionFixture(OrderStatus.Funded), now: 2000n });
  assert.equal(funded.actions.marketplace[0]!.protocolAvailable, true);
  assert.equal(funded.actions.marketplace[0]!.executionAvailable, false);
  assert.equal(funded.actions.customer[0]!.action, "raise-dispute");
  const created = projectMarketplaceOrder({ order: createOrderProjectionFixture(OrderStatus.Created), now: 2000n });
  assert.equal(created.actions.public[0]!.action, "cancel-expired");
  assert.equal(calculateSettlementPayouts(42500001n, splits)[2], 4250001n);
});