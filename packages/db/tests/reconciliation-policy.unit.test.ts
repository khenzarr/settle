import assert from "node:assert/strict";
import test from "node:test";

import { OrderStatus, type SettlementOrderProjection } from "@settle/shared";

import {
  canonicalStatusFor,
  compareCanonicalOrder,
  parseArcReconciliationConfig,
  paymentIntentStateFor,
  reconciliationKey,
  retryReconciliationRpc,
  safeBlockNumber,
  webhookEventTypeFor,
} from "../src/reconciliation-policy.ts";

const BUYER = "0x1111111111111111111111111111111111111111" as const;
const RECIPIENT = "0x2222222222222222222222222222222222222222" as const;
const ORDER_ID = `0x${"11".repeat(32)}` as const;
const TERMS_HASH = `0x${"22".repeat(32)}` as const;

function projection(status: SettlementOrderProjection["status"] = OrderStatus.Created): SettlementOrderProjection {
  return {
    orderId: ORDER_ID,
    exists: true,
    buyer: BUYER,
    totalAmountBaseUnits: 50_000n,
    totalAmountUsdc: "0.05",
    fundingDeadline: 1_800_000_000n,
    settlementDeadline: 1_900_000_000n,
    termsHash: TERMS_HASH,
    createdAt: 1_700_000_000n,
    fundedAt: status >= OrderStatus.Funded && status !== OrderStatus.Cancelled ? 1_700_000_100n : 0n,
    disputedAt: status === OrderStatus.Disputed ? 1_700_000_200n : 0n,
    settledAt: status === OrderStatus.Completed ? 1_700_000_300n : 0n,
    refundedAt: status === OrderStatus.Refunded ? 1_700_000_300n : 0n,
    cancelledAt: status === OrderStatus.Cancelled ? 1_700_000_300n : 0n,
    timestamps: { createdAt: 1_700_000_000n, fundedAt: null, disputedAt: null, settledAt: null, refundedAt: null, cancelledAt: null },
    rawStatus: status,
    status,
    statusLabel: canonicalStatusFor(status),
    settlementRecipients: [RECIPIENT],
    settlementSharesBps: [10_000],
    expectedPayouts: [{ recipient: RECIPIENT, shareBps: 10_000, expectedPayoutBaseUnits: 50_000n, expectedPayoutUsdc: "0.05" }],
    isCreated: status === OrderStatus.Created,
    isFunded: status === OrderStatus.Funded,
    isDisputed: status === OrderStatus.Disputed,
    isTerminal: status === OrderStatus.Completed || status === OrderStatus.Refunded || status === OrderStatus.Cancelled,
    carriesActiveEscrow: status === OrderStatus.Funded || status === OrderStatus.Disputed,
    explorer: { settlementEscrowAddress: "https://example.test/contract", buyerAddress: "https://example.test/buyer", usdcToken: "https://example.test/usdc" },
  };
}

const intent = {
  orderId: ORDER_ID,
  buyerAddress: BUYER,
  amountBaseUnits: 50_000n,
  fundingDeadline: new Date(1_800_000_000_000),
  settlementDeadline: new Date(1_900_000_000_000),
  termsHash: TERMS_HASH,
  recipients: [{ recipientAddress: RECIPIENT, shareBps: 10_000, position: 0 }],
};

test("reconciliation configuration is bounded and defaults to finalized Arc Testnet", () => {
  const config = parseArcReconciliationConfig({});
  assert.equal(config.confirmationDepth, 12);
  assert.equal(config.chunkSize, 2_000);
  assert.equal(config.maxBlocksPerRun, 20_000);
  assert.throws(() => parseArcReconciliationConfig({ ARC_RECONCILIATION_CONFIRMATIONS: "0" }));
  assert.throws(() => parseArcReconciliationConfig({ ARC_RECONCILIATION_CHUNK_SIZE: "200001" }));
  assert.throws(() => parseArcReconciliationConfig({ ARC_RECONCILIATION_MAX_BLOCKS_PER_RUN: "not-a-number" }));
});

test("canonical projection comparison rejects every immutable divergence", () => {
  assert.deepEqual(compareCanonicalOrder(intent, projection()), []);
  assert.deepEqual(compareCanonicalOrder({ ...intent, orderId: `0x${"33".repeat(32)}` }, projection()), ["order_id"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, buyerAddress: "0x3333333333333333333333333333333333333333" }, projection()), ["buyer"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, amountBaseUnits: 49_999n }, projection()), ["amount"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, fundingDeadline: new Date(1_800_000_001_000) }, projection()), ["funding_deadline"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, settlementDeadline: new Date(1_900_000_001_000) }, projection()), ["settlement_deadline"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, termsHash: `0x${"44".repeat(32)}` }, projection()), ["terms_hash"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, recipients: [] }, projection()), ["recipient_count"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, recipients: [{ ...intent.recipients[0]!, recipientAddress: "0x3333333333333333333333333333333333333333" }] }, projection()), ["recipient_0"]);
  assert.deepEqual(compareCanonicalOrder({ ...intent, recipients: [{ ...intent.recipients[0]!, shareBps: 9_999 }] }, projection()), ["share_0"]);
});

test("canonical status, application state, and webhook mappings are explicit", () => {
  assert.equal(canonicalStatusFor(OrderStatus.Created), "created");
  assert.equal(paymentIntentStateFor(projection(), 1_799_999_999n), "awaiting_payment");
  assert.equal(paymentIntentStateFor(projection(), 1_800_000_000n), "payment_window_expired");
  assert.equal(paymentIntentStateFor(projection(OrderStatus.Funded), 1_900_000_000n), "funded");
  assert.equal(webhookEventTypeFor("OrderCreated"), "payment_intent.activated");
  assert.equal(webhookEventTypeFor("OrderReleased"), "payment_intent.completed");
  assert.equal(webhookEventTypeFor("SettlementPaid"), undefined);
});

test("safe head and semantic keys are deterministic", () => {
  assert.equal(safeBlockNumber(100n, 12), 88n);
  assert.equal(safeBlockNumber(5n, 12), undefined);
  assert.equal(reconciliationKey("funded", ORDER_ID, 10n), reconciliationKey("funded", ORDER_ID, 10n));
  assert.notEqual(reconciliationKey("funded", ORDER_ID, 10n), reconciliationKey("funded", ORDER_ID, 11n));
});

test("RPC retries are bounded and preserve the terminal failure", async () => {
  let calls = 0;
  const delays: number[] = [];
  const noWait = async (milliseconds: number) => { delays.push(milliseconds); };
  assert.equal(await retryReconciliationRpc(async () => { calls += 1; if (calls < 3) throw new Error("temporary"); return "ok"; }, 3, noWait), "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1_000, 2_000]);
  calls = 0;
  await assert.rejects(retryReconciliationRpc(async () => { calls += 1; throw new Error("offline"); }, 2, noWait), /offline/);
  assert.equal(calls, 2);
});
