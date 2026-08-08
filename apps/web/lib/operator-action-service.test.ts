import assert from "node:assert/strict";
import { test } from "node:test";
import { ARC_TESTNET, OrderStatus, type RawSettlementOrder, type SettlementEscrowReader } from "@settle/shared";
import { planOperatorAction, OperatorActionError, type OperatorActionDependencies } from "./operator-action-service.server.ts";

const orderId = `0x${"ab".repeat(32)}`;
const buyer = "0x1111111111111111111111111111111111111111";
const operator = "0x4ac8d35f1795531f1e0bef3826db5aab730fcd34";
const order: RawSettlementOrder = { buyer, totalAmount: 1_000_000n, fundingDeadline: 2_000n, settlementDeadline: 3_000n, termsHash: `0x${"cd".repeat(32)}`, createdAt: 1_000n, fundedAt: 1_500n, disputedAt: 0n, settledAt: 0n, refundedAt: 0n, cancelledAt: 0n, status: OrderStatus.Funded };
const splits = [{ recipient: "0x2222222222222222222222222222222222222222", shareBps: 10_000 }];

function reader(current = order): SettlementEscrowReader {
  return {
    readSettlementOrder: async (id) => ({ kind: "known", orderId: id as typeof orderId, exists: true, order: current }),
    readSettlementSplits: async (id) => ({ kind: "known", orderId: id as typeof orderId, exists: true, splits }),
    readTotalActiveEscrow: async () => 0n, readUsdcBalance: async () => 0n, readUsdcAllowance: async () => 0n,
    readSettlementOrderProjection: async () => ({ kind: "unknown", orderId: orderId as typeof orderId, exists: false }),
  };
}

function dependencies(overrides: Partial<OperatorActionDependencies> = {}): OperatorActionDependencies {
  return { reader: reader(), operatorAddress: operator, circleWalletAddress: operator, now: () => 1_100n, ...overrides };
}

const createRequest = { operation: "create-order", orderId, buyer, totalAmountUsdc: "1", fundingDeadline: "2000", settlementDeadline: "3000", termsHash: `0x${"cd".repeat(32)}`, splits } as const;

test("create-order is canonical, publication-safe, and dry-run-only", async () => {
  const response = await planOperatorAction(createRequest, dependencies());
  assert.equal(response.contract.toLowerCase(), ARC_TESTNET.settlementEscrow.address.toLowerCase());
  assert.equal(response.function, "createOrder(bytes32,address,uint256,uint256,uint256,bytes32,address[],uint16[])");
  assert.equal(response.executionRequired, false);
  assert.equal(JSON.stringify(response).includes("idempotency"), false);
});

test("request rejects arbitrary target, calldata, and execution controls", async () => {
  for (const key of ["contractAddress", "abiFunctionSignature", "calldata", "execute", "idempotencyKey"]) {
    await assert.rejects(planOperatorAction({ ...createRequest, [key]: "malicious" }, dependencies()), (error: unknown) => error instanceof OperatorActionError && error.code === "invalid-request");
  }
});

test("release reads canonical Funded order and rejects every other state", async () => {
  const response = await planOperatorAction({ operation: "release-order", orderId }, dependencies());
  assert.equal(response.function, "releaseOrder(bytes32)");
  assert.equal(response.amount?.baseUnits, "1000000");
  for (const status of [OrderStatus.None, OrderStatus.Created, OrderStatus.Disputed, OrderStatus.Completed, OrderStatus.Refunded, OrderStatus.Cancelled]) {
    await assert.rejects(planOperatorAction({ operation: "release-order", orderId }, dependencies({ reader: reader({ ...order, status }) })), (error: unknown) => error instanceof OperatorActionError && error.code === "invalid-order-state");
  }
});

test("unknown order and noncanonical bridge output fail closed", async () => {
  const unknown: SettlementEscrowReader = { ...reader(), readSettlementOrder: async (id) => ({ kind: "unknown", orderId: id as typeof orderId, exists: false }) };
  await assert.rejects(planOperatorAction({ operation: "release-order", orderId }, dependencies({ reader: unknown })), (error: unknown) => error instanceof OperatorActionError && error.code === "unknown-order");
  await assert.rejects(planOperatorAction(createRequest, dependencies({ prepareDryRun: () => ({ operation: "create-order", operatorSigner: operator as never, contractAddress: "0x0000000000000000000000000000000000000001" as never, abiFunctionSignature: "bad", parameterCount: 0, expectedStateTransition: { system: "settlement-escrow", from: OrderStatus.None, to: OrderStatus.Created }, executionRequired: false }) })), (error: unknown) => error instanceof OperatorActionError && error.code === "canonical-state-error");
});
