import assert from "node:assert/strict";
import test from "node:test";
import type { CircleWalletTransactionStatusRecord } from "./wallet-transaction-status.ts";
import { WALLET_TRANSACTION_FAILURE_STATES, WALLET_TRANSACTION_SUCCESS_STATE, createCircleWalletTransactionStatusGateway, formatWalletTransactionStatus, getWalletTransactionStatus, parseWalletTransactionStatusArguments, waitForWalletTransactionStatus } from "./wallet-transaction-status.ts";

const id = "9fcb2e86-dec2-4226-81d1-4dbad429278c";
const otherId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const walletId = "configured-wallet-id";

function record(overrides: Partial<CircleWalletTransactionStatusRecord> = {}): CircleWalletTransactionStatusRecord {
  return {
    id,
    walletId,
    blockchain: "ARC-TESTNET",
    transactionType: "OUTBOUND",
    operation: "TRANSFER",
    state: "SENT",
    createDate: "2026-01-01T00:00:00Z",
    updateDate: "2026-01-01T00:00:01Z",
    ...overrides,
  };
}

function gateway(value: CircleWalletTransactionStatusRecord) {
  let calls = 0;
  return { get calls() { return calls; }, async getTransaction(receivedId: string) { calls += 1; assert.equal(receivedId, id); return value; } };
}

test("valid transaction ID is accepted and passed to the read gateway", async () => {
  const source = gateway(record());
  const result = await getWalletTransactionStatus({ gateway: source, requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(result.transactionId, id);
  assert.equal(source.calls, 1);
});

test("malformed, missing, unknown, and duplicate CLI arguments fail locally", () => {
  assert.throws(() => parseWalletTransactionStatusArguments([]), /required/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", "bad"]), /Invalid UUID/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--unknown"]), /Unsupported argument/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--transaction-id", otherId]), /only be provided once/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--wait", "--wait"]), /only be provided once/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--interval-seconds", "1"]), /at least 2/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--timeout-seconds", "1"]), /between/);
  assert.throws(() => parseWalletTransactionStatusArguments(["--transaction-id", id, "--interval-seconds", "2", "--interval-seconds", "3"]), /only be provided once/);
});

test("response identity and blockchain are validated", async () => {
  await assert.rejects(() => getWalletTransactionStatus({ gateway: gateway(record({ id: otherId })), requestedTransactionId: id, configuredWalletId: walletId }), /different transaction ID/);
  await assert.rejects(() => getWalletTransactionStatus({ gateway: gateway(record({ blockchain: "ETH-SEPOLIA" })), requestedTransactionId: id, configuredWalletId: walletId }), /ARC-TESTNET/);
  await assert.rejects(() => getWalletTransactionStatus({ gateway: gateway(record({ walletId: "other-wallet" })), requestedTransactionId: id, configuredWalletId: walletId }), /another wallet/);
});

test("pending state is preserved without claiming finality and optional fields are safe", async () => {
  const result = await getWalletTransactionStatus({ gateway: gateway(record()), requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(result.state, "SENT");
  assert.equal(result.transactionHash, undefined);
  assert.doesNotMatch(formatWalletTransactionStatus(result).join("\n"), /final|complete/i);
});

test("successful terminal state and every installed terminal failure state are handled", async () => {
  const success = await getWalletTransactionStatus({ gateway: gateway(record({ state: WALLET_TRANSACTION_SUCCESS_STATE })), requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(success.state, "COMPLETE");
  for (const state of ["STUCK", "FAILED", "DENIED", "CANCELLED"] as const) {
    const statuses = [{ state }, { state: "SENT" }];
    let index = 0;
    await assert.rejects(() => waitForWalletTransactionStatus({ retrieve: async () => statuses[index++]!, intervalSeconds: 2, timeoutSeconds: 10, onChange() {}, sleep: async () => {} }), new RegExp(state));
  }
});

test("transaction hash creates the ArcScan transaction URL", async () => {
  const hash = `0x${"a".repeat(64)}`;
  const result = await getWalletTransactionStatus({ gateway: gateway(record({ txHash: hash })), requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(result.transactionHash, hash);
  assert.equal(result.arcScanUrl, `https://testnet.arcscan.app/tx/${hash}`);
  await assert.rejects(() => getWalletTransactionStatus({ gateway: gateway(record({ txHash: "0x1234" })), requestedTransactionId: id, configuredWalletId: walletId }));
});

test("block height and failure detail are bounded and safe", async () => {
  const result = await getWalletTransactionStatus({ gateway: gateway(record({ blockHeight: 12, errorReason: "authorization header 0x1234567890abcdef" })), requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(result.blockHeight, 12);
  assert.equal(result.failureReason, undefined);
  await assert.rejects(() => getWalletTransactionStatus({ gateway: gateway(record({ blockHeight: -1 })), requestedTransactionId: id, configuredWalletId: walletId }), /block height/);
  const longReason = "x".repeat(600);
  const bounded = await getWalletTransactionStatus({ gateway: gateway(record({ errorReason: longReason })), requestedTransactionId: id, configuredWalletId: walletId });
  assert.equal(bounded.failureReason, undefined);
});

test("wait polls the read-only retrieve function, prints state changes, and stops on success", async () => {
  const statuses = [{ state: "SENT" }, { state: "SENT" }, { state: "CONFIRMED" }, { state: "COMPLETE" }];
  let index = 0;
  const printed: string[] = [];
  const result = await waitForWalletTransactionStatus({ retrieve: async () => statuses[index++]!, intervalSeconds: 2, timeoutSeconds: 10, onChange: (status) => printed.push(status.state), sleep: async () => {} });
  assert.equal(result.state, "COMPLETE");
  assert.deepEqual(printed, ["SENT", "CONFIRMED", "COMPLETE"]);
  assert.equal(index, 4);
});

test("wait stops on failure and bounded timeout without any mutation method", async () => {
  let reads = 0;
  await assert.rejects(() => waitForWalletTransactionStatus({ retrieve: async () => { reads += 1; return { state: "FAILED" }; }, intervalSeconds: 2, timeoutSeconds: 10, onChange() {}, sleep: async () => {} }), /FAILED/);
  assert.equal(reads, 1);
  let now = 0;
  await assert.rejects(() => waitForWalletTransactionStatus({ retrieve: async () => ({ state: "SENT" }), intervalSeconds: 2, timeoutSeconds: 2, onChange() {}, sleep: async () => { now = 3000; }, now: () => now }), /Timed out/);
});

test("Circle gateway exposes only the read-only getTransaction operation", () => {
  const client = { getTransaction: async () => ({ data: { transaction: record() } }) };
  const statusGateway = createCircleWalletTransactionStatusGateway(client as unknown as Parameters<typeof createCircleWalletTransactionStatusGateway>[0]);
  assert.deepEqual(Object.keys(statusGateway), ["getTransaction"]);
});