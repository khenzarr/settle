import "server-only";

import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  ARC_TESTNET,
  createHttpSettlementRpcTransport,
  createSettlementEscrowReader,
  decodeSettlementOrderEvent,
  formatUsdcAmount,
  settlementOrderEventTopics,
  SettlementReadError,
  type SettlementEscrowReader,
  type SettlementOrderEvent,
  type SettlementOrderEventKind,
  type SettlementRpcTransport,
} from "@settle/shared";

import type { SettleDatabase } from "./client.ts";
import {
  canonicalStatusFor,
  compareCanonicalOrder,
  paymentIntentStateFor,
  reconciliationKey,
  retryReconciliationRpc,
  safeBlockNumber,
  webhookEventTypeFor,
  type ArcReconciliationConfig,
} from "./reconciliation-policy.ts";
import { AuditRepository } from "./repositories/index.ts";
import {
  chainObservations,
  chainOrders,
  chainReconciliationCursors,
  operatorExecutions,
  paymentIntents,
  reconciliationIssues,
} from "./schema/index.ts";
import { canonicalWebhookJson, webhookPayloadHash } from "./webhook-security.ts";
import { emitPaymentIntentWebhookEvent } from "./webhook-service.ts";

const CURSOR_LEASE_MS = 5 * 60 * 1000;
const RPC_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const RPC_QUANTITY_PATTERN = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

interface RpcBlock {
  readonly number: bigint;
  readonly hash: string;
  readonly timestamp: bigint;
}

interface FinalizedObservation {
  readonly event: SettlementOrderEvent;
  readonly blockHash: string;
}

type ClaimedCursor = typeof chainReconciliationCursors.$inferSelect;

export interface ArcReconciliationRunResult {
  readonly cursorId?: string;
  readonly status: "idle" | "advanced" | "caught_up";
  readonly fromBlock?: string;
  readonly toBlock?: string;
  readonly safeBlock?: string;
  readonly observationCount: number;
  readonly reconciledOrderCount: number;
  readonly reorgDetected: boolean;
}

function quantity(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !RPC_QUANTITY_PATTERN.test(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be a canonical RPC quantity`);
  return BigInt(value);
}

function hash(value: unknown, field: string): string {
  if (typeof value !== "string" || !RPC_HASH_PATTERN.test(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be a 32-byte hash`);
  return value.toLowerCase();
}

function hexData(value: unknown, field: string): `0x${string}` {
  if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be hexadecimal data`);
  return value.toLowerCase() as `0x${string}`;
}

function eventPayload(event: SettlementOrderEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value)) as Record<string, unknown>;
}

function blockNumber(value: bigint): `0x${string}` {
  if (value < 0n) throw new RangeError("Block number cannot be negative");
  return `0x${value.toString(16)}`;
}

function dateFromUnix(value: bigint | null): Date | null {
  if (value === null) return null;
  const milliseconds = value * 1000n;
  if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Canonical timestamp is outside the supported date range");
  const result = new Date(Number(milliseconds));
  if (Number.isNaN(result.getTime())) throw new RangeError("Canonical timestamp is invalid");
  return result;
}

function eventCanonicalStatus(kind: SettlementOrderEventKind): string | undefined {
  return ({
    OrderCreated: "Created",
    OrderFunded: "Funded",
    OrderDisputed: "Disputed",
    OrderReleased: "Completed",
    OrderRefunded: "Refunded",
    OrderCancelled: "Cancelled",
  } as Partial<Record<SettlementOrderEventKind, string>>)[kind];
}

function errorCode(cause: unknown): string {
  if (cause instanceof SettlementReadError) return cause.code.toLowerCase();
  if (cause instanceof Error && /^[a-z0-9_]{1,120}$/i.test(cause.name)) return cause.name.toLowerCase();
  return "reconciliation_failed";
}

export class ArcReconciliationWorker {
  private readonly db: SettleDatabase;
  private readonly config: ArcReconciliationConfig;
  private readonly transport: SettlementRpcTransport;
  private readonly blockCache = new Map<bigint, RpcBlock>();

  constructor(db: SettleDatabase, config: ArcReconciliationConfig, transport?: SettlementRpcTransport) {
    this.db = db;
    this.config = config;
    const baseTransport = transport ?? createHttpSettlementRpcTransport(process.env.ARC_TESTNET_RPC_URL?.trim() || ARC_TESTNET.rpcUrl);
    this.transport = Object.freeze({ request: (method: string, params: readonly unknown[]) => retryReconciliationRpc(() => baseTransport.request(method, params), 5) });
  }

  private reader(blockTag: bigint): SettlementEscrowReader {
    return createSettlementEscrowReader({
      transport: this.transport,
      settlementEscrowAddress: this.config.contractAddress,
      expectedChainId: this.config.chainId,
      usdcAddress: ARC_TESTNET.usdc.address,
      blockTag,
    });
  }

  private async readBlock(number: bigint): Promise<RpcBlock> {
    const cached = this.blockCache.get(number);
    if (cached) return cached;
    const value = await this.transport.request("eth_getBlockByNumber", [blockNumber(number), false]);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "eth_getBlockByNumber returned no block");
    const record = value as Record<string, unknown>;
    const parsed: RpcBlock = { number: quantity(record.number, "block number"), hash: hash(record.hash, "block hash"), timestamp: quantity(record.timestamp, "block timestamp") };
    if (parsed.number !== number) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "RPC block number does not match the requested block");
    this.blockCache.set(number, parsed);
    return parsed;
  }

  private async assertChain(): Promise<void> {
    const actual = quantity(await this.transport.request("eth_chainId", []), "eth_chainId result");
    if (actual !== BigInt(this.config.chainId)) throw new SettlementReadError("WRONG_CHAIN", `Arc reconciliation expected chain ${this.config.chainId} but RPC returned ${actual}`);
  }

  private async ensureCursor(now: Date): Promise<void> {
    await this.db.insert(chainReconciliationCursors).values({
      chainId: BigInt(this.config.chainId),
      contractAddress: this.config.contractAddress.toLowerCase(),
      deploymentBlock: this.config.deploymentBlock,
      confirmationDepth: this.config.confirmationDepth,
      nextBlock: this.config.deploymentBlock,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
  }

  async claimCursor(workerId: string, now = new Date()): Promise<ClaimedCursor | undefined> {
    if (!workerId.trim() || workerId.length > 120) throw new RangeError("Reconciliation worker ID must contain 1 to 120 characters");
    await this.ensureCursor(now);
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.select().from(chainReconciliationCursors).where(and(
        eq(chainReconciliationCursors.chainId, BigInt(this.config.chainId)),
        eq(chainReconciliationCursors.contractAddress, this.config.contractAddress.toLowerCase()),
        or(isNull(chainReconciliationCursors.leaseUntil), lte(chainReconciliationCursors.leaseUntil, now)),
      )).for("update", { skipLocked: true }).limit(1);
      if (!candidate) return undefined;
      const [claimed] = await tx.update(chainReconciliationCursors).set({
        confirmationDepth: this.config.confirmationDepth,
        leaseOwner: workerId,
        leaseUntil: new Date(now.getTime() + CURSOR_LEASE_MS),
        updatedAt: now,
      }).where(eq(chainReconciliationCursors.id, candidate.id)).returning();
      return claimed;
    });
  }

  private async failCursor(cursor: ClaimedCursor, workerId: string, cause: unknown, now: Date): Promise<void> {
    await this.db.update(chainReconciliationCursors).set({
      leaseOwner: null,
      leaseUntil: null,
      consecutiveFailures: sql`${chainReconciliationCursors.consecutiveFailures} + 1`,
      lastErrorCode: errorCode(cause),
      updatedAt: now,
    }).where(and(eq(chainReconciliationCursors.id, cursor.id), eq(chainReconciliationCursors.leaseOwner, workerId)));
  }

  private async recordIssue(input: Readonly<{
    cursorId: string;
    kind: string;
    canonicalKey: string;
    details: Record<string, unknown>;
    now: Date;
    orderId?: string;
    merchantId?: string;
    environmentId?: string;
    paymentIntentId?: string;
    severity?: "warning" | "error";
  }>): Promise<string> {
    return this.db.transaction(async (tx) => {
      const severity: "warning" | "error" = input.severity ?? "error";
      const values = {
        cursorId: input.cursorId,
        merchantId: input.merchantId,
        environmentId: input.environmentId,
        paymentIntentId: input.paymentIntentId,
        orderId: input.orderId,
        kind: input.kind,
        severity,
        state: "open" as const,
        canonicalKey: input.canonicalKey,
        details: input.details,
        firstObservedAt: input.now,
        lastObservedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      };
      const [created] = await tx.insert(reconciliationIssues).values(values).onConflictDoUpdate({
        target: [reconciliationIssues.cursorId, reconciliationIssues.kind, reconciliationIssues.canonicalKey],
        set: { state: "open", details: input.details, lastObservedAt: input.now, resolvedAt: null, updatedAt: input.now },
      }).returning({ id: reconciliationIssues.id });
      if (!created) throw new Error("Reconciliation issue could not be persisted");
      if (input.merchantId && input.environmentId && input.paymentIntentId) {
        await emitPaymentIntentWebhookEvent(tx, {
          merchantId: input.merchantId,
          environmentId: input.environmentId,
          paymentIntentId: input.paymentIntentId,
          type: "payment_intent.reconciliation_issue",
          canonicalEventKey: `issue:${input.canonicalKey}`,
          resource: { id: input.paymentIntentId, object: "payment_intent", order_id: input.orderId, reconciliation: { issue_id: created.id, kind: input.kind, severity, details: input.details } },
          occurredAt: input.now,
        });
      }
      return created.id;
    });
  }

  private async handleReorg(cursor: ClaimedCursor, actualHash: string, now: Date): Promise<readonly string[]> {
    const [observed, projected] = await Promise.all([
      this.db.select({ paymentIntentId: chainObservations.paymentIntentId }).from(chainObservations).where(and(eq(chainObservations.cursorId, cursor.id), eq(chainObservations.state, "canonical"))),
      this.db.select({ paymentIntentId: chainOrders.paymentIntentId }).from(chainOrders).where(and(
        eq(chainOrders.chainId, cursor.chainId),
        eq(chainOrders.contractAddress, cursor.contractAddress),
      )),
    ]);
    const intentIds = [...new Set([...observed, ...projected].map((row) => row.paymentIntentId).filter((value): value is string => Boolean(value)))];
    await this.db.transaction(async (tx) => {
      await tx.update(chainObservations).set({ state: "orphaned", orphanedAt: now, updatedAt: now }).where(and(eq(chainObservations.cursorId, cursor.id), eq(chainObservations.state, "canonical")));
      if (intentIds.length) {
        await tx.update(chainOrders).set({ canonicalStatus: "none", lastVerifiedBlock: null, lastVerifiedBlockHash: null, lastVerifiedPayloadHash: null, verificationState: "stale", lastVerifiedAt: null, updatedAt: now }).where(inArray(chainOrders.paymentIntentId, intentIds));
        await tx.update(paymentIntents).set({ applicationState: "awaiting_activation", canonicalStatus: "none", canonicalObservedAt: null, reconciliationState: "reorg_pending", activatedAt: null, fundedAt: null, completedAt: null, refundedAt: null, cancelledAt: null, checkoutPath: null, updatedAt: now }).where(inArray(paymentIntents.id, intentIds));
        await tx.update(operatorExecutions).set({ state: "ambiguous", transactionHash: null, chainId: null, lastObservedAt: null, completedAt: null, failureCode: "chain_reorg", updatedAt: now }).where(and(inArray(operatorExecutions.paymentIntentId, intentIds), eq(operatorExecutions.operation, "activation")));
      }
      await tx.update(chainReconciliationCursors).set({ nextBlock: cursor.deploymentBlock, lastScannedBlock: null, lastScannedBlockHash: null, lastSafeBlock: null, updatedAt: now }).where(and(eq(chainReconciliationCursors.id, cursor.id), eq(chainReconciliationCursors.leaseOwner, cursor.leaseOwner!)));
    });
    const records = intentIds.length ? await this.db.query.paymentIntents.findMany({ where: inArray(paymentIntents.id, intentIds) }) : [];
    for (const record of records) {
      await this.recordIssue({
        cursorId: cursor.id,
        kind: "chain_reorg",
        canonicalKey: reconciliationKey("chain_reorg", record.orderId, cursor.lastScannedBlock ?? "none", cursor.lastScannedBlockHash ?? "none", actualHash),
        orderId: record.orderId,
        merchantId: record.merchantId,
        environmentId: record.environmentId,
        paymentIntentId: record.id,
        details: { last_scanned_block: cursor.lastScannedBlock?.toString() ?? null, expected_block_hash: cursor.lastScannedBlockHash, observed_block_hash: actualHash, reset_to_block: cursor.deploymentBlock.toString() },
        now,
      });
    }
    return intentIds;
  }

  private parseLog(value: unknown): FinalizedObservation {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log must be an object");
    const record = value as Record<string, unknown>;
    if (record.removed === true) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Finalized lifecycle scan returned a removed log");
    if (typeof record.address !== "string" || record.address.toLowerCase() !== this.config.contractAddress.toLowerCase()) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log contract address is invalid");
    if (!Array.isArray(record.topics) || record.topics.length < 2) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log topics are invalid");
    const topics = record.topics.map((topic, index) => hexData(topic, `log topic ${index}`));
    const block = quantity(record.blockNumber, "log blockNumber");
    const rawIndex = quantity(record.logIndex, "log logIndex");
    if (rawIndex > BigInt(Number.MAX_SAFE_INTEGER)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log index is too large");
    const event = decodeSettlementOrderEvent({
      transactionHash: hash(record.transactionHash, "log transactionHash"),
      blockNumber: block,
      logIndex: rawIndex,
      topics,
      data: hexData(record.data, "log data"),
    });
    return { event, blockHash: hash(record.blockHash, "log blockHash") };
  }

  private async scan(from: bigint, to: bigint): Promise<readonly FinalizedObservation[]> {
    const observations: FinalizedObservation[] = [];
    const topics = settlementOrderEventTopics();
    for (let start = from; start <= to; start += BigInt(this.config.chunkSize)) {
      const end = start + BigInt(this.config.chunkSize) - 1n > to ? to : start + BigInt(this.config.chunkSize) - 1n;
      const result = await this.transport.request("eth_getLogs", [{
        address: this.config.contractAddress,
        fromBlock: blockNumber(start),
        toBlock: blockNumber(end),
        topics: [topics],
      }]);
      if (!Array.isArray(result)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "eth_getLogs did not return an array");
      for (const entry of result) {
        const parsed = this.parseLog(entry);
        if (parsed.event.blockNumber < start || parsed.event.blockNumber > end) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log is outside the requested block range");
        observations.push(parsed);
      }
    }
    observations.sort((left, right) => left.event.blockNumber === right.event.blockNumber ? Number(left.event.logIndex - right.event.logIndex) : left.event.blockNumber < right.event.blockNumber ? -1 : 1);
    return observations;
  }

  private async persistObservations(cursor: ClaimedCursor, observations: readonly FinalizedObservation[], now: Date): Promise<void> {
    for (const observation of observations) {
      const payload = eventPayload(observation.event);
      await this.db.insert(chainObservations).values({
        cursorId: cursor.id,
        chainId: BigInt(this.config.chainId),
        contractAddress: this.config.contractAddress.toLowerCase(),
        orderId: observation.event.orderId.toLowerCase(),
        blockNumber: observation.event.blockNumber,
        blockHash: observation.blockHash,
        transactionHash: observation.event.transactionHash.toLowerCase(),
        logIndex: Number(observation.event.logIndex),
        eventName: observation.event.kind,
        payload,
        payloadHash: webhookPayloadHash(canonicalWebhookJson(payload)),
        state: "canonical",
        observedAt: now,
        canonicalAt: now,
        orphanedAt: null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [chainObservations.cursorId, chainObservations.transactionHash, chainObservations.logIndex],
        set: { blockNumber: observation.event.blockNumber, blockHash: observation.blockHash, eventName: observation.event.kind, payload, payloadHash: webhookPayloadHash(canonicalWebhookJson(payload)), state: "canonical", canonicalAt: now, orphanedAt: null, updatedAt: now },
      });
    }
  }

  private async verifyObservationAnchors(observations: readonly FinalizedObservation[]): Promise<void> {
    for (const observation of observations) {
      const block = await this.readBlock(observation.event.blockNumber);
      if (block.hash !== observation.blockHash) {
        throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log block hash does not match the canonical block");
      }
    }
  }

  private async reconcileOrder(cursor: ClaimedCursor, orderId: string, evidence: readonly FinalizedObservation[], verifiedBlock: RpcBlock, now: Date): Promise<boolean> {
    const matches = await this.db.query.paymentIntents.findMany({ where: eq(paymentIntents.orderId, orderId), with: { recipients: true, chainOrder: true, operatorExecutions: true } });
    if (matches.length !== 1) {
      await this.recordIssue({
        cursorId: cursor.id,
        kind: matches.length === 0 ? "unmatched_chain_order" : "ambiguous_payment_intent",
        canonicalKey: reconciliationKey(matches.length === 0 ? "unmatched_chain_order" : "ambiguous_payment_intent", orderId),
        orderId,
        details: { matching_payment_intent_count: matches.length, verified_block: verifiedBlock.number.toString(), verified_block_hash: verifiedBlock.hash },
        now,
      });
      return false;
    }
    const intent = matches[0]!;
    const canonical = await this.reader(verifiedBlock.number).readSettlementOrderProjection(orderId);
    if (canonical.kind === "unknown") {
      await this.recordIssue({
        cursorId: cursor.id,
        kind: "canonical_order_missing",
        canonicalKey: reconciliationKey("canonical_order_missing", orderId, verifiedBlock.hash),
        orderId,
        merchantId: intent.merchantId,
        environmentId: intent.environmentId,
        paymentIntentId: intent.id,
        details: { verified_block: verifiedBlock.number.toString(), verified_block_hash: verifiedBlock.hash },
        now,
      });
      return false;
    }
    const projection = canonical.projection;
    const mismatches = compareCanonicalOrder(intent, projection);
    const canonicalStatus = canonicalStatusFor(projection.status);
    const projectionPayload = JSON.parse(JSON.stringify(projection, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value)) as Record<string, unknown>;
    const projectionHash = `0x${webhookPayloadHash(canonicalWebhookJson(projectionPayload))}`;
    const state = paymentIntentStateFor(projection, verifiedBlock.timestamp);
    const evidenceBlocks = new Map<bigint, RpcBlock>();
    for (const item of evidence) {
      if (item.event.kind === "OrderCreated" || webhookEventTypeFor(item.event.kind)) {
        const block = await this.readBlock(item.event.blockNumber);
        if (block.hash !== item.blockHash) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log block hash does not match the canonical block");
        evidenceBlocks.set(item.event.blockNumber, block);
      }
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(chainOrders).values({
        paymentIntentId: intent.id,
        chainId: BigInt(this.config.chainId),
        contractAddress: this.config.contractAddress.toLowerCase(),
        orderId: projection.orderId.toLowerCase(),
        termsHash: projection.termsHash.toLowerCase(),
        canonicalStatus,
        lastVerifiedBlock: verifiedBlock.number,
        lastVerifiedBlockHash: verifiedBlock.hash,
        lastVerifiedPayloadHash: projectionHash,
        verificationState: mismatches.length ? "error" : "verified",
        lastVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: chainOrders.paymentIntentId,
        set: { chainId: BigInt(this.config.chainId), contractAddress: this.config.contractAddress.toLowerCase(), orderId: projection.orderId.toLowerCase(), termsHash: projection.termsHash.toLowerCase(), canonicalStatus, lastVerifiedBlock: verifiedBlock.number, lastVerifiedBlockHash: verifiedBlock.hash, lastVerifiedPayloadHash: projectionHash, verificationState: mismatches.length ? "error" : "verified", lastVerifiedAt: now, updatedAt: now },
      });
      await tx.update(chainObservations).set({ merchantId: intent.merchantId, environmentId: intent.environmentId, paymentIntentId: intent.id, updatedAt: now }).where(and(eq(chainObservations.cursorId, cursor.id), eq(chainObservations.orderId, orderId), eq(chainObservations.state, "canonical")));

      if (mismatches.length) {
        await tx.update(paymentIntents).set({ canonicalStatus, canonicalObservedAt: now, reconciliationState: "diverged", updatedAt: now }).where(eq(paymentIntents.id, intent.id));
        return;
      }

      await tx.update(paymentIntents).set({
        applicationState: state,
        canonicalStatus,
        canonicalObservedAt: now,
        reconciliationState: "reconciled",
        activatedAt: dateFromUnix(projection.timestamps.createdAt),
        fundedAt: dateFromUnix(projection.timestamps.fundedAt),
        completedAt: canonicalStatus === "completed" ? dateFromUnix(projection.timestamps.settledAt) : null,
        refundedAt: dateFromUnix(projection.timestamps.refundedAt),
        cancelledAt: dateFromUnix(projection.timestamps.cancelledAt),
        checkoutPath: `/pay/${projection.orderId}`,
        updatedAt: now,
      }).where(eq(paymentIntents.id, intent.id));

      const creation = evidence.find((entry) => entry.event.kind === "OrderCreated");
      if (creation) {
        const creationBlock = evidenceBlocks.get(creation.event.blockNumber)!;
        await tx.update(operatorExecutions).set({ state: "succeeded", transactionHash: creation.event.transactionHash.toLowerCase(), chainId: BigInt(this.config.chainId), submittedAt: dateFromUnix(creationBlock.timestamp), completedAt: dateFromUnix(creationBlock.timestamp), lastObservedAt: now, failureCode: null, updatedAt: now }).where(and(eq(operatorExecutions.paymentIntentId, intent.id), eq(operatorExecutions.operation, "activation")));
      }
      await tx.update(reconciliationIssues).set({ state: "resolved", resolvedAt: now, lastObservedAt: now, updatedAt: now }).where(and(
        eq(reconciliationIssues.cursorId, cursor.id),
        eq(reconciliationIssues.orderId, intent.orderId),
        eq(reconciliationIssues.state, "open"),
      ));
      if (intent.applicationState !== state || intent.canonicalStatus !== canonicalStatus || intent.reconciliationState !== "reconciled") {
        await new AuditRepository(tx).appendForTenant(intent, { actorType: "worker", actorSubject: cursor.leaseOwner ?? "arc-reconciliation", action: "payment_intent.reconciled", resourceType: "payment_intent", resourceId: intent.id, metadataJson: { previousApplicationState: intent.applicationState, applicationState: state, previousCanonicalStatus: intent.canonicalStatus, canonicalStatus, verifiedBlock: verifiedBlock.number.toString(), verifiedBlockHash: verifiedBlock.hash } });
      }

      for (const item of evidence) {
        const type = webhookEventTypeFor(item.event.kind);
        const status = eventCanonicalStatus(item.event.kind);
        if (!type || !status) continue;
        const observedBlock = evidenceBlocks.get(item.event.blockNumber)!;
        await emitPaymentIntentWebhookEvent(tx, {
          merchantId: intent.merchantId,
          environmentId: intent.environmentId,
          paymentIntentId: intent.id,
          type,
          canonicalEventKey: `chain:${this.config.chainId}:${item.event.transactionHash}:${item.event.logIndex}`,
          resource: {
            id: intent.id,
            object: "payment_intent",
            external_order_id: intent.externalOrderId,
            order_id: intent.orderId,
            buyer: intent.buyerAddress,
            amount: formatUsdcAmount(intent.amountBaseUnits),
            currency: intent.currency,
            canonical: { status, observed_at: dateFromUnix(observedBlock.timestamp)?.toISOString(), block_number: item.event.blockNumber.toString(), block_hash: item.blockHash, transaction_hash: item.event.transactionHash, log_index: item.event.logIndex.toString(), verification_state: "verified" },
          },
          occurredAt: dateFromUnix(observedBlock.timestamp) ?? now,
        });
      }

      if (state === "payment_window_expired") {
        await emitPaymentIntentWebhookEvent(tx, {
          merchantId: intent.merchantId,
          environmentId: intent.environmentId,
          paymentIntentId: intent.id,
          type: "payment_intent.payment_window_expired",
          canonicalEventKey: `deadline:${projection.fundingDeadline}`,
          resource: { id: intent.id, object: "payment_intent", order_id: intent.orderId, application_state: state, canonical: { status: "Created", observed_at: dateFromUnix(verifiedBlock.timestamp)?.toISOString(), block_number: verifiedBlock.number.toString(), block_hash: verifiedBlock.hash, verification_state: "verified" } },
          occurredAt: dateFromUnix(verifiedBlock.timestamp) ?? now,
        });
      }
    });

    if (mismatches.length) {
      await this.recordIssue({
        cursorId: cursor.id,
        kind: "immutable_order_mismatch",
        canonicalKey: reconciliationKey("immutable_order_mismatch", orderId, ...mismatches),
        orderId,
        merchantId: intent.merchantId,
        environmentId: intent.environmentId,
        paymentIntentId: intent.id,
        details: { mismatched_fields: mismatches, verified_block: verifiedBlock.number.toString(), verified_block_hash: verifiedBlock.hash },
        now,
      });
      return false;
    }
    return true;
  }

  async runOnce(workerId: string, now = new Date()): Promise<ArcReconciliationRunResult> {
    const cursor = await this.claimCursor(workerId, now);
    if (!cursor) return { status: "idle", observationCount: 0, reconciledOrderCount: 0, reorgDetected: false };
    try {
      this.blockCache.clear();
      await this.assertChain();
      const latest = quantity(await this.transport.request("eth_blockNumber", []), "latest block");
      const safe = safeBlockNumber(latest, this.config.confirmationDepth);
      if (safe === undefined || safe < cursor.deploymentBlock) {
        await this.db.update(chainReconciliationCursors).set({ lastSafeBlock: safe ?? null, leaseOwner: null, leaseUntil: null, consecutiveFailures: 0, lastErrorCode: null, lastSuccessfulRunAt: now, updatedAt: now }).where(and(eq(chainReconciliationCursors.id, cursor.id), eq(chainReconciliationCursors.leaseOwner, workerId)));
        return { cursorId: cursor.id, status: "caught_up", safeBlock: safe?.toString(), observationCount: 0, reconciledOrderCount: 0, reorgDetected: false };
      }

      let reorgDetected = false;
      let nextBlock = cursor.nextBlock;
      if (cursor.lastScannedBlock !== null && cursor.lastScannedBlockHash) {
        const anchor = await this.readBlock(cursor.lastScannedBlock);
        if (anchor.hash !== cursor.lastScannedBlockHash) {
          reorgDetected = true;
          await this.handleReorg(cursor, anchor.hash, now);
          nextBlock = cursor.deploymentBlock;
        }
      }

      if (nextBlock > safe) {
        await this.db.update(chainReconciliationCursors).set({ lastSafeBlock: safe, leaseOwner: null, leaseUntil: null, consecutiveFailures: 0, lastErrorCode: null, lastSuccessfulRunAt: now, updatedAt: now }).where(and(eq(chainReconciliationCursors.id, cursor.id), eq(chainReconciliationCursors.leaseOwner, workerId)));
        return { cursorId: cursor.id, status: "caught_up", safeBlock: safe.toString(), observationCount: 0, reconciledOrderCount: 0, reorgDetected };
      }

      const maximum = nextBlock + BigInt(this.config.maxBlocksPerRun) - 1n;
      const toBlock = maximum > safe ? safe : maximum;
      const observations = await this.scan(nextBlock, toBlock);
      await this.verifyObservationAnchors(observations);
      await this.persistObservations(cursor, observations, now);
      const verifiedBlock = await this.readBlock(toBlock);
      const grouped = new Map<string, FinalizedObservation[]>();
      for (const observation of observations) {
        const values = grouped.get(observation.event.orderId) ?? [];
        values.push(observation);
        grouped.set(observation.event.orderId, values);
      }
      if (toBlock === safe) {
        const activeOrders = await this.db.select({ orderId: chainOrders.orderId }).from(chainOrders).where(and(
          eq(chainOrders.chainId, BigInt(this.config.chainId)),
          eq(chainOrders.contractAddress, this.config.contractAddress.toLowerCase()),
          inArray(chainOrders.canonicalStatus, ["created", "funded", "disputed"]),
        ));
        for (const active of activeOrders) if (!grouped.has(active.orderId)) grouped.set(active.orderId, []);
      }
      let reconciledOrderCount = 0;
      for (const [orderId, evidence] of grouped) if (await this.reconcileOrder(cursor, orderId, evidence, verifiedBlock, now)) reconciledOrderCount += 1;

      const [advanced] = await this.db.update(chainReconciliationCursors).set({
        nextBlock: toBlock + 1n,
        lastScannedBlock: toBlock,
        lastScannedBlockHash: verifiedBlock.hash,
        lastSafeBlock: safe,
        leaseOwner: null,
        leaseUntil: null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastSuccessfulRunAt: now,
        updatedAt: now,
      }).where(and(eq(chainReconciliationCursors.id, cursor.id), eq(chainReconciliationCursors.leaseOwner, workerId))).returning({ id: chainReconciliationCursors.id });
      if (!advanced) throw new Error("Reconciliation cursor lease was lost before checkpointing");
      return { cursorId: cursor.id, status: toBlock === safe ? "caught_up" : "advanced", fromBlock: nextBlock.toString(), toBlock: toBlock.toString(), safeBlock: safe.toString(), observationCount: observations.length, reconciledOrderCount, reorgDetected };
    } catch (cause) {
      await this.failCursor(cursor, workerId, cause, now);
      throw cause;
    }
  }
}
