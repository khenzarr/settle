import assert from "node:assert/strict";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";

import { ARC_TESTNET, settlementOrderEventTopics, type SettlementRpcTransport } from "@settle/shared";

import { ArcReconciliationWorker } from "../src/arc-reconciliation-worker.ts";
import { createDatabaseClient } from "../src/client.ts";
import { MerchantPaymentIntentService, projectMerchantPaymentIntent } from "../src/payment-intent-service.ts";
import {
  auditEvents,
  chainObservations,
  chainOrders,
  chainReconciliationCursors,
  idempotencyKeys,
  merchantEnvironments,
  merchants,
  operatorExecutions,
  paymentIntentRecipients,
  paymentIntents,
  reconciliationIssues,
  webhookDeliveries,
  webhookDeliveryAttempts,
  webhookEndpoints,
  webhookEvents,
} from "../src/schema/index.ts";

const CONTRACT = "0x4444444444444444444444444444444444444444";
const BUYER = "0x1111111111111111111111111111111111111111";
const RECIPIENT = "0x2222222222222222222222222222222222222222";

const word = (value: bigint) => value.toString(16).padStart(64, "0");
const addressWord = (value: string) => value.slice(2).padStart(64, "0");
const bytes32Word = (value: string) => value.slice(2);
const hash = (byte: string) => `0x${byte.repeat(64)}`;

function encodeOrder(input: Readonly<{ buyer: string; amount: bigint; funding: bigint; settlement: bigint; termsHash: string; createdAt: bigint }>): string {
  return `0x${[
    addressWord(input.buyer),
    word(input.amount),
    word(input.funding),
    word(input.settlement),
    bytes32Word(input.termsHash),
    word(input.createdAt),
    word(0n),
    word(0n),
    word(0n),
    word(0n),
    word(0n),
    word(1n),
  ].join("")}`;
}

function encodeSplits(recipient: string): string {
  const first = `${word(1n)}${addressWord(recipient)}`;
  const second = `${word(1n)}${word(10_000n)}`;
  return `0x${word(64n)}${word(64n + BigInt(first.length / 2))}${first}${second}`;
}

class ReconciliationTransport implements SettlementRpcTransport {
  latest = 112n;
  readonly blockHashes = new Map<bigint, string>();
  readonly logs: Record<string, unknown>[] = [];
  private readonly orderResult: string;
  private readonly splitsResult: string;
  private readonly timestamp: bigint;
  private callIndex = 0;
  constructor(orderResult: string, splitsResult: string, timestamp: bigint) {
    this.orderResult = orderResult;
    this.splitsResult = splitsResult;
    this.timestamp = timestamp;
  }
  resetCalls() { this.callIndex = 0; }
  async request(method: string, params: readonly unknown[]): Promise<unknown> {
    if (method === "eth_chainId") return `0x${ARC_TESTNET.chainId.toString(16)}`;
    if (method === "eth_blockNumber") return `0x${this.latest.toString(16)}`;
    if (method === "eth_getLogs") {
      const filter = params[0] as { fromBlock: string; toBlock: string };
      const from = BigInt(filter.fromBlock);
      const to = BigInt(filter.toBlock);
      return this.logs.filter((log) => BigInt(String(log.blockNumber)) >= from && BigInt(String(log.blockNumber)) <= to);
    }
    if (method === "eth_getBlockByNumber") {
      const number = BigInt(String(params[0]));
      return { number: `0x${number.toString(16)}`, hash: this.blockHashes.get(number) ?? hash("a"), timestamp: `0x${this.timestamp.toString(16)}` };
    }
    if (method === "eth_call") {
      const results = [`0x${word(1n)}`, this.orderResult, this.splitsResult];
      const result = results[this.callIndex++];
      if (!result) throw new Error("Unexpected eth_call");
      return result;
    }
    throw new Error(`Unexpected RPC method: ${method}`);
  }
}

test("Arc reconciliation is finalized, replay-safe, tenant-constrained, and invalidates projections on reorg", async () => {
  const client = createDatabaseClient(process.env);
  const merchantIds: string[] = [];
  try {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const [merchant] = await client.db.insert(merchants).values({ name: "M1.E Reconciliation", slug: `m1e-${suffix}`, status: "active" }).returning({ id: merchants.id });
    assert.ok(merchant);
    merchantIds.push(merchant.id);
    const [environment] = await client.db.insert(merchantEnvironments).values({ merchantId: merchant.id, kind: "test", status: "active", displayName: "M1.E" }).returning({ id: merchantEnvironments.id });
    assert.ok(environment);
    const tenant = { merchantId: merchant.id, environmentId: environment.id };
    const now = new Date();
    const service = new MerchantPaymentIntentService(client.db);
    const apiKeyId = crypto.randomUUID();
    const created = await service.create({
      ...tenant,
      apiKeyId,
      idempotencyKey: `m1e-${suffix}`,
      requestId: crypto.randomUUID(),
      now,
      body: {
        external_order_id: `order-${suffix}`,
        buyer: BUYER,
        amount: "0.05",
        currency: "USDC",
        funding_deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        settlement_deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settlement_recipients: [{ address: RECIPIENT, share_bps: 10_000 }],
      },
    });
    const intentId = String(created.body.id);
    await service.activate({ ...tenant, apiKeyId, paymentIntentId: intentId, idempotencyKey: `m1e-activate-${suffix}`, requestId: crypto.randomUUID(), now });
    const intent = await client.db.query.paymentIntents.findFirst({ where: eq(paymentIntents.id, intentId), with: { recipients: true } });
    assert.ok(intent);
    const funding = BigInt(Math.floor(intent.fundingDeadline.getTime() / 1000));
    const settlement = BigInt(Math.floor(intent.settlementDeadline.getTime() / 1000));
    const blockTimestamp = funding - 10n;
    const transport = new ReconciliationTransport(encodeOrder({ buyer: intent.buyerAddress, amount: intent.amountBaseUnits, funding, settlement, termsHash: intent.termsHash, createdAt: blockTimestamp - 100n }), encodeSplits(RECIPIENT), blockTimestamp);
    transport.blockHashes.set(110n, hash("a"));
    transport.logs.push({
      address: CONTRACT,
      blockNumber: "0x69",
      blockHash: hash("a"),
      transactionHash: hash("6"),
      logIndex: "0x0",
      removed: false,
      topics: [settlementOrderEventTopics()[0], intent.orderId, `0x${intent.buyerAddress.slice(2).padStart(64, "0")}`],
      data: `0x${word(intent.amountBaseUnits)}${word(funding)}${word(settlement)}${bytes32Word(intent.termsHash)}`,
    });
    const config = { chainId: ARC_TESTNET.chainId, contractAddress: CONTRACT, deploymentBlock: 100n, confirmationDepth: 2, chunkSize: 5, maxBlocksPerRun: 20 } as const;
    const worker = new ArcReconciliationWorker(client.db, config, transport);
    const first = await worker.runOnce(`m1e-${suffix}`, now);
    assert.equal(first.status, "caught_up");
    assert.equal(first.toBlock, "110");
    assert.equal(first.observationCount, 1);
    assert.equal(first.reconciledOrderCount, 1);
    const projected = await client.db.query.paymentIntents.findFirst({ where: eq(paymentIntents.id, intent.id), with: { chainOrder: true, recipients: true, operatorExecutions: true } });
    assert.equal(projected?.applicationState, "awaiting_payment");
    assert.equal(projected?.canonicalStatus, "created");
    assert.equal(projected?.reconciliationState, "reconciled");
    const projectedResource = projectMerchantPaymentIntent(projected!);
    assert.equal(projectedResource.reconciliation_state, "reconciled");
    assert.equal(projectedResource.canonical?.block_number, "110");
    assert.equal(projectedResource.canonical?.block_hash, transport.blockHashes.get(110n));
    assert.match(projectedResource.canonical?.payload_hash ?? "", /^0x[0-9a-f]{64}$/);
    assert.equal(projected?.chainOrder?.lastVerifiedBlock, 110n);
    assert.equal(projected?.chainOrder?.lastVerifiedBlockHash, hash("a"));
    const [activation] = await client.db.select().from(operatorExecutions).where(eq(operatorExecutions.paymentIntentId, intent.id));
    assert.equal(activation?.state, "succeeded");
    assert.equal(activation?.transactionHash, hash("6"));
    assert.equal(activation?.chainId, BigInt(ARC_TESTNET.chainId));

    const [cursor] = await client.db.select().from(chainReconciliationCursors).where(eq(chainReconciliationCursors.contractAddress, CONTRACT));
    assert.ok(cursor);
    assert.equal((await client.db.select().from(chainObservations).where(eq(chainObservations.paymentIntentId, intent.id))).length, 1);
    await assert.rejects(client.db.insert(chainObservations).values({ cursorId: cursor.id, merchantId: merchant.id, chainId: BigInt(ARC_TESTNET.chainId), contractAddress: CONTRACT, orderId: intent.orderId, blockNumber: 106n, blockHash: hash("5"), transactionHash: hash("7"), logIndex: 0, eventName: "OrderCreated", payload: { kind: "OrderCreated" }, payloadHash: "7".repeat(64), state: "canonical", observedAt: now, canonicalAt: now }));

    await client.db.update(chainReconciliationCursors).set({ nextBlock: 100n, lastScannedBlock: null, lastScannedBlockHash: null, lastSafeBlock: null }).where(eq(chainReconciliationCursors.id, cursor.id));
    transport.resetCalls();
    const replay = await worker.runOnce(`m1e-replay-${suffix}`, new Date(now.getTime() + 500));
    assert.equal(replay.observationCount, 1);
    assert.equal((await client.db.select().from(chainObservations).where(eq(chainObservations.paymentIntentId, intent.id))).length, 1);
    assert.equal((await client.db.select().from(webhookEvents).where(eq(webhookEvents.paymentIntentId, intent.id))).length, 2);

    transport.latest = 122n;
    transport.logs.length = 0;
    transport.blockHashes.set(110n, hash("b"));
    transport.blockHashes.set(119n, hash("c"));
    const second = await worker.runOnce(`m1e-${suffix}`, new Date(now.getTime() + 1_000));
    assert.equal(second.reorgDetected, true);
    const invalidated = await client.db.query.paymentIntents.findFirst({ where: eq(paymentIntents.id, intent.id), with: { chainOrder: true } });
    assert.equal(invalidated?.applicationState, "awaiting_activation");
    assert.equal(invalidated?.canonicalStatus, "none");
    assert.equal(invalidated?.reconciliationState, "reorg_pending");
    assert.equal(invalidated?.chainOrder?.verificationState, "stale");
    const [invalidatedActivation] = await client.db.select().from(operatorExecutions).where(eq(operatorExecutions.paymentIntentId, intent.id));
    assert.equal(invalidatedActivation?.state, "ambiguous");
    assert.equal(invalidatedActivation?.transactionHash, null);
    assert.equal((await client.db.select().from(chainObservations).where(eq(chainObservations.paymentIntentId, intent.id)))[0]?.state, "orphaned");
    assert.equal((await client.db.select().from(reconciliationIssues).where(eq(reconciliationIssues.paymentIntentId, intent.id)))[0]?.kind, "chain_reorg");
  } finally {
    if (merchantIds.length) {
      const intentRows = await client.db.select({ id: paymentIntents.id }).from(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      const intentIds = intentRows.map((row) => row.id);
      const deliveryRows = await client.db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      if (deliveryRows.length) await client.db.delete(webhookDeliveryAttempts).where(inArray(webhookDeliveryAttempts.deliveryId, deliveryRows.map((row) => row.id)));
      await client.db.delete(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      await client.db.delete(webhookEvents).where(inArray(webhookEvents.merchantId, merchantIds));
      await client.db.delete(webhookEndpoints).where(inArray(webhookEndpoints.merchantId, merchantIds));
      await client.db.delete(reconciliationIssues).where(inArray(reconciliationIssues.merchantId, merchantIds));
      if (intentIds.length) await client.db.delete(chainObservations).where(inArray(chainObservations.paymentIntentId, intentIds));
      if (intentIds.length) await client.db.delete(chainOrders).where(inArray(chainOrders.paymentIntentId, intentIds));
      await client.db.delete(auditEvents).where(inArray(auditEvents.merchantId, merchantIds));
      await client.db.delete(idempotencyKeys).where(inArray(idempotencyKeys.merchantId, merchantIds));
      await client.db.delete(operatorExecutions).where(inArray(operatorExecutions.merchantId, merchantIds));
      if (intentIds.length) await client.db.delete(paymentIntentRecipients).where(inArray(paymentIntentRecipients.paymentIntentId, intentIds));
      await client.db.delete(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      await client.db.delete(merchantEnvironments).where(inArray(merchantEnvironments.merchantId, merchantIds));
      await client.db.delete(merchants).where(inArray(merchants.id, merchantIds));
      await client.db.delete(chainReconciliationCursors).where(eq(chainReconciliationCursors.contractAddress, CONTRACT));
    }
    await client.close();
  }
});
