import assert from "node:assert/strict";
import test from "node:test";
import { buyerRecoveryStorageKey, parseBuyerOperationRecovery, recoveryFromOperation, serializeBuyerOperationRecovery, type StoredBuyerOperationRecovery } from "./buyer-operation-recovery-storage.ts";
import { createBuyerOperation, transitionBuyerOperation } from "./buyer-transaction-progress.ts";

const orderId = `0x${"11".repeat(32)}`;
const hash = `0x${"aa".repeat(32)}`;
const record: StoredBuyerOperationRecovery = { version: 1, orderId, operation: "approve", transactionHash: hash, progress: "pending-receipt" };

test("buyer recovery storage validates and isolates public records", () => {
  assert.deepEqual(parseBuyerOperationRecovery(JSON.parse(serializeBuyerOperationRecovery(record)), orderId, "approve"), { ...record, orderId, transactionHash: hash });
  assert.notEqual(buyerRecoveryStorageKey(orderId, "approve"), buyerRecoveryStorageKey(orderId, "fund"));
  assert.notEqual(buyerRecoveryStorageKey(orderId, "approve"), buyerRecoveryStorageKey(`0x${"22".repeat(32)}`, "approve"));
  assert.equal(parseBuyerOperationRecovery("{"), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, version: 2 }), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, transactionHash: "0x123" }), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, orderId: "0x123" }), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, operation: "release" }), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, progress: "state-confirmed" }), null);
  assert.equal(parseBuyerOperationRecovery({ ...record, extra: true }), null);
});

test("only hash-bearing recoverable progress persists", () => {
  const idle = createBuyerOperation(orderId, "fund");
  assert.equal(recoveryFromOperation(idle), null);
  const submitting = transitionBuyerOperation(idle, { type: "start-submit" });
  assert.equal(recoveryFromOperation(submitting), null);
  const pending = transitionBuyerOperation(submitting, { type: "submission-returned-hash", transactionHash: hash });
  assert.equal(recoveryFromOperation(pending)?.operation, "fund");
  const included = transitionBuyerOperation(pending, { type: "receipt-included" });
  assert.equal(recoveryFromOperation(included)?.progress, "included-awaiting-state");
});