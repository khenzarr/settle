import test from "node:test";
import assert from "node:assert/strict";
import { ARC_TESTNET, OrderStatus, type SettlementEscrowReader, type SettlementOrderReadResult, type SettlementTransactionReceipt } from "@settle/shared";
import { confirmBuyerTransaction, confirmWithBoundedPolling } from "./buyer-transaction-confirmation.ts";

const ORDER_ID = `0x${"ab".repeat(32)}`;
const HASH = `0x${"cd".repeat(32)}`;
const BUYER = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const OTHER = "0x2222222222222222222222222222222222222222" as `0x${string}`;
const receipt = (patch: Partial<SettlementTransactionReceipt> = {}): SettlementTransactionReceipt => ({ transactionHash: HASH, status: 1, from: BUYER, to: ARC_TESTNET.usdc.address, blockNumber: 12n, ...patch });
function deps({ orderStatus = OrderStatus.Created, allowance = 0n, tx = receipt(), receiptReader }: { orderStatus?: number; allowance?: bigint; tx?: SettlementTransactionReceipt | null; receiptReader?: () => Promise<SettlementTransactionReceipt | null> } = {}): { reader: SettlementEscrowReader } {
  const order = { buyer: BUYER, totalAmount: 100n, fundingDeadline: 9999999999n, settlementDeadline: 9999999999n, termsHash: `0x${"ef".repeat(32)}` as `0x${string}`, createdAt: 1n, fundedAt: 0n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, status: orderStatus };
  const result: SettlementOrderReadResult = { kind: "known", orderId: ORDER_ID as `0x${string}`, exists: true, order };
  return { reader: { readSettlementOrder: async () => result, readSettlementSplits: async () => ({ kind: "unknown", orderId: ORDER_ID as `0x${string}`, exists: false }), readTotalActiveEscrow: async () => 0n, readUsdcBalance: async () => 0n, readUsdcAllowance: async () => allowance, readTransactionReceipt: receiptReader ?? (async () => tx), readSettlementOrderProjection: async () => ({ kind: "unknown", orderId: ORDER_ID as `0x${string}`, exists: false }) } };
}

test("pending receipt is not success", async () => assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ tx: null }))).confirmationStatus, "pending"));
test("failed receipt is reverted", async () => assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ tx: receipt({ status: 0 }) }))).confirmationStatus, "reverted"));
test("approve confirms only at or above exact amount", async () => {
  assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ allowance: 99n }))).confirmationStatus, "included-awaiting-state");
  assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ allowance: 100n }))).confirmationStatus, "state-confirmed");
  assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ allowance: 101n }))).confirmationStatus, "state-confirmed");
});
test("fund confirms only when canonical order is Funded", async () => {
  const fundReceipt = receipt({ to: ARC_TESTNET.settlementEscrow.address });
  assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "fund-order" }, deps({ tx: fundReceipt }))).confirmationStatus, "included-awaiting-state");
  assert.equal((await confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "fund-order" }, deps({ orderStatus: OrderStatus.Funded, tx: fundReceipt }))).confirmationStatus, "state-confirmed");
});
test("identity mismatches are rejected", async () => {
  await assert.rejects(confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ tx: receipt({ from: OTHER }) })), { code: "IDENTITY_MISMATCH" });
  await assert.rejects(confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "approve-usdc" }, deps({ tx: receipt({ to: ARC_TESTNET.settlementEscrow.address }) })), { code: "IDENTITY_MISMATCH" });
  await assert.rejects(confirmBuyerTransaction({ orderId: ORDER_ID, transactionHash: HASH, operation: "fund-order" }, deps({ tx: receipt({ to: ARC_TESTNET.usdc.address }) })), { code: "IDENTITY_MISMATCH" });
});
test("bounded polling stops without claiming success", async () => {
  let calls = 0;
  const dependency = deps({ receiptReader: async () => { calls += 1; return null; } });
  const result = await confirmWithBoundedPolling({ orderId: ORDER_ID, transactionHash: HASH, operation: "fund-order" }, dependency, { maxAttempts: 3, delay: async () => undefined });
  assert.equal(result.confirmationStatus, "pending");
  assert.equal(calls, 3);
});