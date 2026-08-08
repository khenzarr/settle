import { orderIdSchema, transactionHashSchema } from "@settle/shared";
import { normalizeTransactionHash, type BuyerOperation, type BuyerOperationProgress, type BuyerOperationRecord } from "./buyer-transaction-progress.ts";

export const BUYER_RECOVERY_VERSION = 1 as const;
export const BUYER_RECOVERY_PREFIX = "settle:buyer-operation:v1";
export type RecoverableProgress = "pending-receipt" | "included-awaiting-state" | "confirmation-error";

export interface StoredBuyerOperationRecovery {
  readonly version: typeof BUYER_RECOVERY_VERSION;
  readonly orderId: string;
  readonly operation: BuyerOperation;
  readonly transactionHash: string;
  readonly progress: RecoverableProgress;
}

const RECOVERABLE: readonly RecoverableProgress[] = ["pending-receipt", "included-awaiting-state", "confirmation-error"];
const OPERATIONS: readonly BuyerOperation[] = ["approve", "fund"];

export function buyerRecoveryStorageKey(orderId: string, operation: BuyerOperation): string {
  return `${BUYER_RECOVERY_PREFIX}:${orderId.toLowerCase()}:${operation}`;
}

export function isRecoverableProgress(progress: BuyerOperationProgress): progress is RecoverableProgress {
  return RECOVERABLE.includes(progress as RecoverableProgress);
}

export function serializeBuyerOperationRecovery(value: StoredBuyerOperationRecovery): string {
  return JSON.stringify(value);
}

export function parseBuyerOperationRecovery(value: unknown, expectedOrderId?: string, expectedOperation?: BuyerOperation): StoredBuyerOperationRecovery | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "operation,orderId,progress,transactionHash,version") return null;
  if (record.version !== BUYER_RECOVERY_VERSION || typeof record.orderId !== "string" || typeof record.operation !== "string" || typeof record.transactionHash !== "string" || typeof record.progress !== "string") return null;
  const parsedOrderId = orderIdSchema.safeParse(record.orderId);
  const parsedHash = transactionHashSchema.safeParse(record.transactionHash);
  if (!parsedOrderId.success || !parsedHash.success || !OPERATIONS.includes(record.operation as BuyerOperation) || !RECOVERABLE.includes(record.progress as RecoverableProgress)) return null;
  if (expectedOrderId && parsedOrderId.data.toLowerCase() !== expectedOrderId.toLowerCase()) return null;
  if (expectedOperation && record.operation !== expectedOperation) return null;
  return { version: BUYER_RECOVERY_VERSION, orderId: parsedOrderId.data.toLowerCase(), operation: record.operation as BuyerOperation, transactionHash: normalizeTransactionHash(parsedHash.data), progress: record.progress as RecoverableProgress };
}

export function recoveryFromOperation(record: BuyerOperationRecord): StoredBuyerOperationRecovery | null {
  if (!record.transactionHash || !isRecoverableProgress(record.progress)) return null;
  return { version: BUYER_RECOVERY_VERSION, orderId: record.orderId.toLowerCase(), operation: record.operation, transactionHash: normalizeTransactionHash(record.transactionHash), progress: record.progress };
}

export function readBuyerOperationRecovery(orderId: string, operation: BuyerOperation): StoredBuyerOperationRecovery | null {
  if (typeof window === "undefined") return null;
  try { return parseBuyerOperationRecovery(window.sessionStorage.getItem(buyerRecoveryStorageKey(orderId, operation)) ? JSON.parse(window.sessionStorage.getItem(buyerRecoveryStorageKey(orderId, operation)) as string) : null, orderId, operation); } catch { return null; }
}

export function writeBuyerOperationRecovery(value: StoredBuyerOperationRecovery): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(buyerRecoveryStorageKey(value.orderId, value.operation), serializeBuyerOperationRecovery(value)); } catch { /* Storage is optional. */ }
}

export function clearBuyerOperationRecovery(orderId: string, operation: BuyerOperation): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(buyerRecoveryStorageKey(orderId, operation)); } catch { /* Storage is optional. */ }
}