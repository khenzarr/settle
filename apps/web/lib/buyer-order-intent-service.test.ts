import assert from "node:assert/strict";
import { test } from "node:test";
import { ARC_TESTNET, OrderStatus, type RawSettlementOrder, type SettlementEscrowReader } from "@settle/shared";
import { BuyerOrderError, loadBuyerOrder } from "./buyer-order-intent-service.ts";

const orderId = `0x${"ab".repeat(32)}`;
const buyer = "0x1111111111111111111111111111111111111111";
const amount = 1234567n;
const order: RawSettlementOrder = {
  buyer, totalAmount: amount, fundingDeadline: 2_000n, settlementDeadline: 3_000n,
  termsHash: `0x${"cd".repeat(32)}`, createdAt: 1_000n, fundedAt: 0n, disputedAt: 0n,
  settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, status: OrderStatus.Created,
};

function reader(allowance: bigint, current = order, calls: string[] = []): SettlementEscrowReader {
  return {
    readSettlementOrder: async (id) => { calls.push(`order:${id}`); return { kind: "known", orderId: id as typeof orderId, exists: true, order: current }; },
    readSettlementSplits: async () => { throw new Error("unexpected split read"); },
    readTotalActiveEscrow: async () => { throw new Error("unexpected write-like read"); },
    readUsdcBalance: async () => { throw new Error("unexpected balance read"); },
    readUsdcAllowance: async (owner, spender) => { calls.push(`allowance:${owner}:${spender}`); return allowance; },
    readSettlementOrderProjection: async () => { throw new Error("unexpected projection read"); },
  };
}

test("derives intents and allowance only from the canonical order", async () => {
  const calls: string[] = [];
  const response = await loadBuyerOrder({ orderId }, { reader: reader(amount, order, calls), now: () => 1_500n });
  assert.equal(response.buyer, buyer);
  assert.equal(response.amount.baseUnits, amount.toString());
  assert.equal(response.approveIntent.to.toLowerCase(), ARC_TESTNET.usdc.address.toLowerCase());
  assert.equal(response.approveIntent.data.slice(0, 10), "0x095ea7b3");
  assert.equal(response.fundIntent.to.toLowerCase(), ARC_TESTNET.settlementEscrow.address.toLowerCase());
  assert.equal(response.fundReady, true);
  assert.deepEqual(calls, [`order:${orderId}`, `allowance:${buyer}:${ARC_TESTNET.settlementEscrow.address}`]);
  assert.equal(JSON.stringify(response).includes("1234567"), true);
});

test("rejects unknown and expired orders while projecting canonical non-Created state", async () => {
  const unknown: SettlementEscrowReader = { ...reader(0n), readSettlementOrder: async (id) => ({ kind: "unknown", orderId: id as typeof orderId, exists: false }) };
  await assert.rejects(loadBuyerOrder({ orderId }, { reader: unknown }), (error: unknown) => error instanceof BuyerOrderError && error.code === "UNKNOWN_ORDER");
  const funded = await loadBuyerOrder({ orderId }, { reader: reader(0n, { ...order, status: OrderStatus.Funded }) });
  assert.equal(funded.status, String(OrderStatus.Funded));
  await assert.rejects(loadBuyerOrder({ orderId }, { reader: reader(0n), now: () => 2_000n }), (error: unknown) => error instanceof BuyerOrderError && error.code === "EXPIRED_DEADLINE");
});

test("fund readiness uses exact allowance comparison", async () => {
  for (const [allowance, ready] of [[amount - 1n, false], [amount, true], [amount + 1n, true]] as const) {
    const response = await loadBuyerOrder({ orderId }, { reader: reader(allowance), now: () => 1_500n });
    assert.equal(response.fundReady, ready);
    assert.equal(response.allowance.baseUnits, allowance.toString());
  }
});