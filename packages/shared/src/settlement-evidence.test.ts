import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";

import { getExplorerTransactionUrl } from "./explorer.ts";
import { OrderStatus } from "./order.ts";
import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { MAX_EVIDENCE_LOG_BLOCK_RANGE, readOrderEvidence } from "./settlement-evidence.ts";
import type { SettlementEscrowReader, SettlementRpcTransport } from "./settlement-read.ts";

const ORDER_ID = `0x${"ab".repeat(32)}` as `0x${string}`;
const BUYER = `0x${"11".repeat(20)}` as `0x${string}`;
const RECIPIENT_A = `0x${"22".repeat(20)}` as `0x${string}`;
const RECIPIENT_B = `0x${"33".repeat(20)}` as `0x${string}`;
const TERMS_HASH = `0x${"cd".repeat(32)}` as `0x${string}`;

function hash(byte: string): string { return `0x${byte.repeat(64)}`; }
function topics(eventName: string, args: Record<string, unknown>): readonly Hex[] {
  return encodeEventTopics({ abi: settlementEscrowAbi, eventName: eventName as never, args: args as never }) as readonly Hex[];
}
function lifecycleLog(eventName: string, blockNumber: bigint, logIndex: bigint, transactionHash: string, args: Record<string, unknown>, data: Hex): Record<string, unknown> {
  return { transactionHash, blockNumber: `0x${blockNumber.toString(16)}`, logIndex: `0x${logIndex.toString(16)}`, topics: topics(eventName, args), data };
}
function eventData(types: readonly { type: string }[], values: readonly unknown[]): Hex { return encodeAbiParameters(types as never, values as never); }

function reader(): SettlementEscrowReader {
  const projection = { orderId: ORDER_ID, exists: true as const, buyer: BUYER, totalAmountBaseUnits: 50_000n, totalAmountUsdc: "0.050000", fundingDeadline: 1n, settlementDeadline: 2n, termsHash: TERMS_HASH, createdAt: 1n, fundedAt: 2n, disputedAt: 0n, settledAt: 4n, refundedAt: 0n, cancelledAt: 0n, timestamps: { createdAt: 1n, fundedAt: 2n, disputedAt: null, settledAt: 4n, refundedAt: null, cancelledAt: null }, rawStatus: OrderStatus.Completed, status: OrderStatus.Completed, statusLabel: "Completed", settlementRecipients: [RECIPIENT_A, RECIPIENT_B], settlementSharesBps: [9_000, 1_000], expectedPayouts: [], isCreated: false, isFunded: false, isDisputed: false, isTerminal: true, carriesActiveEscrow: false, explorer: { settlementEscrowAddress: "", buyerAddress: "", usdcToken: "" } };
  return { readSettlementOrder: async () => ({ kind: "unknown", orderId: ORDER_ID, exists: false }), readSettlementSplits: async () => ({ kind: "unknown", orderId: ORDER_ID, exists: false }), readTotalActiveEscrow: async () => 0n, readUsdcBalance: async () => 0n, readUsdcAllowance: async () => 0n, readSettlementOrderProjection: async () => ({ kind: "known", orderId: ORDER_ID, exists: true, projection }), readTransactionReceipt: async () => null };
}

function transport(logs: unknown[], calls: { method: string; params: readonly unknown[] }[] = [], latest = 12n): SettlementRpcTransport {
  return { request: async (method, params) => { calls.push({ method, params }); if (method === "eth_blockNumber") return `0x${latest.toString(16)}`; if (method === "eth_getLogs") return logs; throw new Error(`unexpected ${method}`); } };
}

test("projects canonical state, ordered lifecycle evidence, duplicate payouts, exact links and six decimals", async () => {
  const created = lifecycleLog("OrderCreated", 10n, 2n, hash("1"), { orderId: ORDER_ID, buyer: BUYER }, eventData([{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }], [50_000n, 1n, 2n, TERMS_HASH]));
  const funded = lifecycleLog("OrderFunded", 11n, 0n, hash("2"), { orderId: ORDER_ID, buyer: BUYER }, eventData([{ type: "uint256" }, { type: "uint256" }], [50_000n, 2n]));
  const paidA = lifecycleLog("SettlementPaid", 12n, 0n, hash("3"), { orderId: ORDER_ID, recipient: RECIPIENT_A }, eventData([{ type: "uint256" }], [45_000n]));
  const paidB = lifecycleLog("SettlementPaid", 12n, 1n, hash("3"), { orderId: ORDER_ID, recipient: RECIPIENT_B }, eventData([{ type: "uint256" }], [5_000n]));
  const released = lifecycleLog("OrderReleased", 12n, 2n, hash("3"), { orderId: ORDER_ID, buyer: BUYER }, eventData([{ type: "uint256" }, { type: "uint256" }], [50_000n, 4n]));
  const result = await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: transport([released, paidB, paidA, funded, created, paidA]), deploymentBlock: 10n, chunkSize: 100n });
  assert.equal(result.canonicalStatus, OrderStatus.Completed);
  assert.deepEqual(result.timeline.map((entry) => entry.event), ["OrderCreated", "OrderFunded", "OrderReleased"]);
  assert.deepEqual(result.settlementPayouts.map((payout) => payout.amountUsdc), ["0.045000", "0.005000"]);
  assert.equal(result.summary.observedSettlementAmountUsdc, "0.050000");
  assert.equal(result.summary.payoutTotalMatches, true);
  assert.equal(result.settlementPayouts[0]?.explorerUrl, getExplorerTransactionUrl(hash("3")));
  assert.equal(result.completeness, "complete");
});

test("starts at deployment, uses bounded chunks, ignores wrong-order logs, and exposes no write RPC", async () => {
  const calls: { method: string; params: readonly unknown[] }[] = [];
  const other = lifecycleLog("OrderCreated", 10n, 0n, hash("4"), { orderId: `0x${"ef".repeat(32)}`, buyer: BUYER }, eventData([{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }], [1n, 1n, 2n, TERMS_HASH]));
  const result = await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: transport([other], calls, 14n), deploymentBlock: 10n, chunkSize: 5n });
  assert.equal(calls[0]?.method, "eth_blockNumber");
  const logCalls = calls.filter((call) => call.method === "eth_getLogs");
  assert.equal(logCalls.length, 1);
  const request = logCalls[0]?.params[0] as { fromBlock: string; toBlock: string; topics: unknown[] };
  assert.equal(request.fromBlock, "0xa");
  assert.equal(request.toBlock, "0xe");
  assert.equal(request.topics.length, 2);
  assert.equal(result.timeline.length, 0);
  assert.equal(calls.some((call) => call.method.includes("send") || call.method.includes("sign")), false);
});

test("malformed evidence becomes partial while canonical state remains available", async () => {
  const result = await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: transport([{ malformed: true }]), deploymentBlock: 10n, chunkSize: 100n });
  assert.equal(result.canonicalStatus, OrderStatus.Completed);
  assert.equal(result.completeness, "partial");
  assert.equal(result.summary.payoutTotalMatches, false);
  assert.equal(result.warnings.length, 1);
});

test("uses one combined bounded log query for a span within the configured range", async () => {
  const calls: { method: string; params: readonly unknown[] }[] = [];
  await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: transport([], calls, 100n), deploymentBlock: 10n });
  const logCalls = calls.filter((call) => call.method === "eth_getLogs");
  assert.equal(logCalls.length, 1);
  const request = logCalls[0]?.params[0] as { address: string; fromBlock: string; toBlock: string; topics: unknown[] };
  assert.equal(request.address, "0x3e438ae878a8dc02c83f5545047cbde33a4f795f");
  assert.equal(request.fromBlock, "0xa");
  assert.equal(request.toBlock, "0x64");
  assert.equal(request.topics.length, 2);
  assert.equal(Array.isArray(request.topics[0]), true);
  assert.equal((request.topics[0] as unknown[]).length, 8);
  assert.equal(request.topics[1], `0x${"ab".repeat(32)}`);
});

test("uses exactly two deterministic log queries for a span just over the max range", async () => {
  const calls: { method: string; params: readonly unknown[] }[] = [];
  const latest = 10n + MAX_EVIDENCE_LOG_BLOCK_RANGE;
  await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: transport([], calls, latest), deploymentBlock: 10n });
  const logCalls = calls.filter((call) => call.method === "eth_getLogs");
  assert.equal(logCalls.length, 2);
  assert.equal((logCalls[0]?.params[0] as { fromBlock: string; toBlock: string }).fromBlock, "0xa");
  assert.equal((logCalls[0]?.params[0] as { fromBlock: string; toBlock: string }).toBlock, `0x${(9n + MAX_EVIDENCE_LOG_BLOCK_RANGE).toString(16)}`);
  assert.equal((logCalls[1]?.params[0] as { fromBlock: string; toBlock: string }).fromBlock, `0x${(10n + MAX_EVIDENCE_LOG_BLOCK_RANGE).toString(16)}`);
});

test("keeps provider failure bounded and does not replace canonical state", async () => {
  const calls: { method: string; params: readonly unknown[] }[] = [];
  const failingTransport: SettlementRpcTransport = { request: async (method, params) => {
    calls.push({ method, params });
    if (method === "eth_blockNumber") return "0x64";
    throw new Error("HTTP 429");
  } };
  const result = await readOrderEvidence({ orderId: ORDER_ID, reader: reader(), transport: failingTransport, deploymentBlock: 10n });
  assert.equal(result.canonicalStatus, OrderStatus.Completed);
  assert.equal(result.completeness, "partial");
  assert.equal(calls.filter((call) => call.method === "eth_getLogs").length, 1);
});
