import { createHash } from "node:crypto";

import { ARC_TESTNET, OrderStatus, type SettlementOrderEventKind, type SettlementOrderProjection } from "@settle/shared";

export const ARC_RECONCILIATION_CONFIRMATIONS_ENV = "ARC_RECONCILIATION_CONFIRMATIONS" as const;
export const ARC_RECONCILIATION_CHUNK_SIZE_ENV = "ARC_RECONCILIATION_CHUNK_SIZE" as const;
export const ARC_RECONCILIATION_MAX_BLOCKS_ENV = "ARC_RECONCILIATION_MAX_BLOCKS_PER_RUN" as const;

export interface ArcReconciliationConfig {
  readonly chainId: number;
  readonly contractAddress: string;
  readonly deploymentBlock: bigint;
  readonly confirmationDepth: number;
  readonly chunkSize: number;
  readonly maxBlocksPerRun: number;
}

export interface ReconciliationIntentShape {
  readonly orderId: string;
  readonly buyerAddress: string;
  readonly amountBaseUnits: bigint;
  readonly fundingDeadline: Date;
  readonly settlementDeadline: Date;
  readonly termsHash: string;
  readonly recipients: readonly Readonly<{ recipientAddress: string; shareBps: number; position: number }>[];
}

export type CanonicalOrderStatus = "none" | "created" | "funded" | "disputed" | "completed" | "refunded" | "cancelled";
export type ReconciledPaymentIntentState = "awaiting_payment" | "payment_window_expired" | "funded" | "disputed" | "completed" | "refunded" | "cancelled";

function integer(values: Readonly<Record<string, string | undefined>>, name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = values[name]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  return value;
}

export function parseArcReconciliationConfig(values: Readonly<Record<string, string | undefined>> = process.env): ArcReconciliationConfig {
  return Object.freeze({
    chainId: ARC_TESTNET.chainId,
    contractAddress: ARC_TESTNET.settlementEscrow.address,
    deploymentBlock: ARC_TESTNET.settlementEscrow.deploymentBlock,
    confirmationDepth: integer(values, ARC_RECONCILIATION_CONFIRMATIONS_ENV, 12, 1, 1024),
    chunkSize: integer(values, ARC_RECONCILIATION_CHUNK_SIZE_ENV, 2_000, 1, 200_000),
    maxBlocksPerRun: integer(values, ARC_RECONCILIATION_MAX_BLOCKS_ENV, 20_000, 1, 1_000_000),
  });
}

export function canonicalStatusFor(status: number): CanonicalOrderStatus {
  switch (status) {
    case OrderStatus.None: return "none";
    case OrderStatus.Created: return "created";
    case OrderStatus.Funded: return "funded";
    case OrderStatus.Disputed: return "disputed";
    case OrderStatus.Completed: return "completed";
    case OrderStatus.Refunded: return "refunded";
    case OrderStatus.Cancelled: return "cancelled";
    default: throw new RangeError(`Unsupported canonical order status: ${status}`);
  }
}

export function paymentIntentStateFor(projection: SettlementOrderProjection, blockTimestamp: bigint): ReconciledPaymentIntentState {
  switch (projection.status) {
    case OrderStatus.Created: return blockTimestamp >= projection.fundingDeadline ? "payment_window_expired" : "awaiting_payment";
    case OrderStatus.Funded: return "funded";
    case OrderStatus.Disputed: return "disputed";
    case OrderStatus.Completed: return "completed";
    case OrderStatus.Refunded: return "refunded";
    case OrderStatus.Cancelled: return "cancelled";
    default: throw new RangeError("A reconciled Payment Intent requires an existing canonical order");
  }
}

function unixSeconds(value: Date): bigint {
  return BigInt(Math.floor(value.getTime() / 1000));
}

export function compareCanonicalOrder(intent: ReconciliationIntentShape, projection: SettlementOrderProjection): readonly string[] {
  const mismatches: string[] = [];
  if (intent.orderId.toLowerCase() !== projection.orderId.toLowerCase()) mismatches.push("order_id");
  if (intent.buyerAddress.toLowerCase() !== projection.buyer.toLowerCase()) mismatches.push("buyer");
  if (intent.amountBaseUnits !== projection.totalAmountBaseUnits) mismatches.push("amount");
  if (unixSeconds(intent.fundingDeadline) !== projection.fundingDeadline) mismatches.push("funding_deadline");
  if (unixSeconds(intent.settlementDeadline) !== projection.settlementDeadline) mismatches.push("settlement_deadline");
  if (intent.termsHash.toLowerCase() !== projection.termsHash.toLowerCase()) mismatches.push("terms_hash");
  const recipients = [...intent.recipients].sort((left, right) => left.position - right.position);
  if (recipients.length !== projection.settlementRecipients.length) mismatches.push("recipient_count");
  else {
    for (let index = 0; index < recipients.length; index += 1) {
      if (recipients[index]!.recipientAddress.toLowerCase() !== projection.settlementRecipients[index]!.toLowerCase()) mismatches.push(`recipient_${index}`);
      if (recipients[index]!.shareBps !== projection.settlementSharesBps[index]) mismatches.push(`share_${index}`);
    }
  }
  return mismatches;
}

export function webhookEventTypeFor(kind: SettlementOrderEventKind): "payment_intent.activated" | "payment_intent.funded" | "payment_intent.disputed" | "payment_intent.completed" | "payment_intent.refunded" | "payment_intent.cancelled" | undefined {
  switch (kind) {
    case "OrderCreated": return "payment_intent.activated";
    case "OrderFunded": return "payment_intent.funded";
    case "OrderDisputed": return "payment_intent.disputed";
    case "OrderReleased": return "payment_intent.completed";
    case "OrderRefunded": return "payment_intent.refunded";
    case "OrderCancelled": return "payment_intent.cancelled";
    case "SettlementPaid":
    case "DisputeResolved": return undefined;
  }
}

export function reconciliationKey(...parts: readonly (string | number | bigint)[]): string {
  return createHash("sha256").update(parts.map(String).join(":"), "utf8").digest("hex");
}

export function safeBlockNumber(latest: bigint, confirmationDepth: number): bigint | undefined {
  if (latest < 0n || !Number.isInteger(confirmationDepth) || confirmationDepth < 1) throw new RangeError("Safe block inputs are invalid");
  const depth = BigInt(confirmationDepth);
  return latest < depth ? undefined : latest - depth;
}

type ReconciliationDelay = (milliseconds: number) => Promise<void>;

const waitForRetry: ReconciliationDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function retryReconciliationRpc<T>(operation: () => Promise<T>, attempts = 3, delay: ReconciliationDelay = waitForRetry): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new RangeError("RPC attempts must be an integer from 1 to 5");
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await operation(); }
    catch (cause) {
      lastError = cause;
      if (attempt === attempts) throw cause;
      await delay(Math.min(1_000 * 2 ** (attempt - 1), 8_000));
    }
  }
  throw lastError;
}
