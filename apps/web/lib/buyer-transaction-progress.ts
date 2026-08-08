export type BuyerOperation = "approve" | "fund";
export type BuyerOperationProgress =
  | "idle"
  | "submitting"
  | "pending-receipt"
  | "included-awaiting-state"
  | "state-confirmed"
  | "reverted"
  | "submission-error"
  | "confirmation-error";
export type RecoveryDecision = "none" | "confirm-existing" | "safe-to-start-new" | "manual-review";
export type BuyerOperationEvent =
  | { type: "start-submit" }
  | { type: "submission-returned-hash"; transactionHash: string }
  | { type: "submission-failed"; transactionHash?: string }
  | { type: "receipt-pending" }
  | { type: "receipt-reverted" }
  | { type: "receipt-included" }
  | { type: "canonical-state-confirmed" }
  | { type: "confirmation-failed"; recoverable?: boolean }
  | { type: "reset-after-explicit-user-action" };

export interface BuyerOperationRecord {
  readonly orderId: string;
  readonly operation: BuyerOperation;
  readonly transactionHash: string | null;
  readonly progress: BuyerOperationProgress;
}

export interface BuyerOperationState extends BuyerOperationRecord {
  readonly submitAllowed: boolean;
  readonly duplicateSubmissionBlocked: boolean;
  readonly recovery: RecoveryDecision;
  readonly isSuccessful: boolean;
  readonly isInFlight: boolean;
  readonly isTerminal: boolean;
  readonly statusLabel: string;
  readonly statusMessage: string;
}

const HASH = /^0x[0-9a-fA-F]{64}$/;
const IN_FLIGHT: readonly BuyerOperationProgress[] = ["submitting", "pending-receipt", "included-awaiting-state"];

export function isTransactionHash(value: string): boolean { return HASH.test(value); }
export function normalizeTransactionHash(value: string): string {
  if (!isTransactionHash(value)) throw new Error("Transaction hash must be 0x followed by 64 hexadecimal characters");
  return value.toLowerCase();
}

export function createBuyerOperation(orderId: string, operation: BuyerOperation): BuyerOperationRecord {
  return { orderId, operation, transactionHash: null, progress: "idle" };
}

const transitionError = (record: BuyerOperationRecord, event: BuyerOperationEvent): never => {
  throw new Error(`Illegal transaction progress transition: ${record.progress} -> ${event.type}`);
};

export function transitionBuyerOperation(record: BuyerOperationRecord, event: BuyerOperationEvent): BuyerOperationRecord {
  switch (event.type) {
    case "start-submit":
      if (record.progress !== "idle") return transitionError(record, event);
      return { ...record, progress: "submitting", transactionHash: null };
    case "submission-returned-hash":
      if (record.progress !== "submitting") return transitionError(record, event);
      return { ...record, progress: "pending-receipt", transactionHash: normalizeTransactionHash(event.transactionHash) };
    case "submission-failed":
      if (record.progress !== "submitting") return transitionError(record, event);
      return { ...record, progress: "submission-error", transactionHash: event.transactionHash ? normalizeTransactionHash(event.transactionHash) : null };
    case "receipt-pending":
      if (record.progress !== "submitting" && record.progress !== "pending-receipt") return transitionError(record, event);
      return { ...record, progress: "pending-receipt" };
    case "receipt-reverted":
      if (record.progress !== "pending-receipt") return transitionError(record, event);
      return { ...record, progress: "reverted" };
    case "receipt-included":
      if (record.progress !== "pending-receipt") return transitionError(record, event);
      return { ...record, progress: "included-awaiting-state" };
    case "canonical-state-confirmed":
      if (record.progress !== "included-awaiting-state") return transitionError(record, event);
      return { ...record, progress: "state-confirmed" };
    case "confirmation-failed":
      if (record.progress !== "pending-receipt" && record.progress !== "included-awaiting-state") return transitionError(record, event);
      return { ...record, progress: "confirmation-error" };
    case "reset-after-explicit-user-action":
      if (record.progress === "idle" || IN_FLIGHT.includes(record.progress)) return transitionError(record, event);
      return { ...record, progress: "idle", transactionHash: null };
  }
}

export function projectBuyerOperation(record: BuyerOperationRecord): BuyerOperationState {
  const { progress, transactionHash } = record;
  const isInFlight = IN_FLIGHT.includes(progress);
  const isSuccessful = progress === "state-confirmed";
  const duplicateSubmissionBlocked = isInFlight || isSuccessful;
  let recovery: RecoveryDecision = "none";
  if (progress === "idle") recovery = "safe-to-start-new";
  else if (progress === "pending-receipt" || progress === "included-awaiting-state") recovery = transactionHash ? "confirm-existing" : "manual-review";
  else if (progress === "confirmation-error") recovery = transactionHash ? "confirm-existing" : "manual-review";
  else if (progress === "submitting" || progress === "submission-error" || progress === "reverted") recovery = "manual-review";
  const copy: Record<BuyerOperationProgress, [string, string]> = {
    idle: ["Ready", "Ready to submit this operation."],
    submitting: ["Submitting", "Wallet submission is in progress; wait before trying again."],
    "pending-receipt": ["Waiting for receipt", transactionHash ? "Transaction submitted — waiting for receipt." : "Submission outcome is uncertain — do not resubmit yet."],
    "included-awaiting-state": ["Confirming canonical state", "Transaction included — confirming canonical state."],
    "state-confirmed": ["Confirmed", "Canonical state confirmed; no new submission is needed."],
    reverted: ["Reverted", "Transaction reverted. Review the cause before explicitly trying again."],
    "submission-error": ["Submission error", "Wallet submission failed or may be ambiguous. Review before explicitly trying again."],
    "confirmation-error": ["Confirmation unavailable", "Canonical confirmation failed. Recover the existing transaction before resubmitting."],
  };
  return { ...record, submitAllowed: !duplicateSubmissionBlocked && (progress === "idle" || progress === "reverted" || progress === "submission-error"), duplicateSubmissionBlocked, recovery, isSuccessful, isInFlight, isTerminal: isSuccessful || progress === "reverted" || progress === "submission-error" || progress === "confirmation-error", statusLabel: copy[progress][0], statusMessage: copy[progress][1] };
}