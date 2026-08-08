import { encodeEventTopics, isHex, type Hex } from "viem";

import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { ARC_TESTNET } from "./chains.ts";
import { getExplorerBlockUrl, getExplorerTransactionUrl } from "./explorer.ts";
import { formatUsdcAmountFixed } from "./money.ts";
import { orderStatusLabel, type OrderStatus as OrderStatusValue } from "./order.ts";
import { orderIdSchema, transactionHashSchema, type EvmAddress, type OrderId, type TransactionHash } from "./schemas.ts";
import { decodeSettlementOrderEvent, SETTLEMENT_ORDER_EVENT_KINDS, type SettlementEventLog, type SettlementOrderEvent, type SettlementOrderEventKind } from "./settlement-events.ts";
import { SettlementReadError, type SettlementEscrowReader, type SettlementRpcTransport } from "./settlement-read.ts";

export const MAX_EVIDENCE_LOG_BLOCK_RANGE = 200_000n;

export interface OrderEvidenceTimelineEntry {
  event: SettlementOrderEventKind;
  label: string;
  transactionHash: TransactionHash;
  blockNumber: string;
  explorerUrl: string;
  blockExplorerUrl: string;
}

export interface OrderEvidencePayout {
  recipient: EvmAddress;
  amountBaseUnits: string;
  amountUsdc: string;
  transactionHash: TransactionHash;
  blockNumber: string;
  explorerUrl: string;
}

export interface OrderEvidence {
  orderId: OrderId;
  canonicalStatus: OrderStatusValue;
  canonicalStatusLabel: string;
  timeline: readonly OrderEvidenceTimelineEntry[];
  settlementPayouts: readonly OrderEvidencePayout[];
  summary: {
    expectedAmountBaseUnits: string;
    expectedAmountUsdc: string;
    observedSettlementAmountBaseUnits: string;
    observedSettlementAmountUsdc: string;
    payoutCount: number;
    payoutTotalMatches: boolean;
  };
  completeness: "complete" | "partial";
  warnings: readonly string[];
}

export type SettlementEvidenceErrorCode = "INVALID_ORDER_ID" | "UNKNOWN_ORDER" | "WRONG_CHAIN" | "EVIDENCE_UNAVAILABLE" | "MALFORMED_EVIDENCE";

export class SettlementEvidenceError extends Error {
  readonly code: SettlementEvidenceErrorCode;
  constructor(code: SettlementEvidenceErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "SettlementEvidenceError";
    this.code = code;
    if (options.cause !== undefined) this.cause = options.cause;
  }
  declare readonly cause?: unknown;
}

function quantity(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} is not a valid RPC quantity`);
  return BigInt(value);
}

function log(value: unknown): SettlementEventLog {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log is not an object");
  const item = value as Record<string, unknown>;
  if (typeof item.transactionHash !== "string" || !isHex(item.transactionHash) || !Array.isArray(item.topics) || typeof item.data !== "string" || !isHex(item.data)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log has invalid public fields");
  const topics = item.topics.map((topic) => { if (typeof topic !== "string" || !isHex(topic)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "Lifecycle log has an invalid topic"); return topic as Hex; });
  return { transactionHash: transactionHashSchema.parse(item.transactionHash), blockNumber: quantity(item.blockNumber, "blockNumber"), logIndex: quantity(item.logIndex, "logIndex"), topics, data: item.data };
}

function label(kind: SettlementOrderEventKind): string {
  return ({ OrderCreated: "Order created", OrderFunded: "Escrow funded", SettlementPaid: "Settlement paid", OrderReleased: "Settlement released", OrderRefunded: "Order refunded", OrderCancelled: "Order cancelled", OrderDisputed: "Order disputed", DisputeResolved: "Dispute resolved" } as const)[kind];
}

function orderTopic(kind: SettlementOrderEventKind, orderId: OrderId): Hex {
  const topics = encodeEventTopics({ abi: settlementEscrowAbi, eventName: kind as never, args: { orderId } as never });
  return topics[1] as Hex;
}

function eventTopic(kind: SettlementOrderEventKind): Hex {
  const topics = encodeEventTopics({ abi: settlementEscrowAbi, eventName: kind as never });
  return topics[0] as Hex;
}

function projectEvent(event: SettlementOrderEvent): OrderEvidenceTimelineEntry | OrderEvidencePayout {
  const base = { transactionHash: event.transactionHash, blockNumber: event.blockNumber.toString(), explorerUrl: getExplorerTransactionUrl(event.transactionHash), blockExplorerUrl: getExplorerBlockUrl(event.blockNumber) };
  if (event.kind === "SettlementPaid") return { ...base, recipient: event.recipient, amountBaseUnits: event.recipientAmount.toString(), amountUsdc: formatUsdcAmountFixed(event.recipientAmount) };
  return { ...base, event: event.kind, label: label(event.kind) };
}

export async function readOrderEvidence(input: { transport: SettlementRpcTransport; reader: SettlementEscrowReader; orderId: unknown; deploymentBlock?: bigint; chunkSize?: bigint }): Promise<OrderEvidence> {
  let orderId: OrderId;
  try { orderId = orderIdSchema.parse(input.orderId); } catch (cause) { throw new SettlementEvidenceError("INVALID_ORDER_ID", "Order ID must be a bytes32 value.", { cause }); }
  let canonical: Awaited<ReturnType<SettlementEscrowReader["readSettlementOrderProjection"]>>;
  try {
    canonical = await input.reader.readSettlementOrderProjection(orderId);
  } catch (cause) {
    if (cause instanceof SettlementReadError && cause.code === "WRONG_CHAIN") throw new SettlementEvidenceError("WRONG_CHAIN", "The configured RPC is not Arc Testnet.", { cause });
    throw new SettlementEvidenceError("EVIDENCE_UNAVAILABLE", "Unable to read the canonical order state.", { cause });
  }
  if (canonical.kind === "unknown") throw new SettlementEvidenceError("UNKNOWN_ORDER", "The order does not exist.");
  const warnings: string[] = [];
  const deploymentBlock = input.deploymentBlock ?? ARC_TESTNET.settlementEscrow.deploymentBlock;
  const chunkSize = input.chunkSize ?? MAX_EVIDENCE_LOG_BLOCK_RANGE;
  if (deploymentBlock < 0n || chunkSize <= 0n) throw new SettlementEvidenceError("MALFORMED_EVIDENCE", "Evidence scan configuration is invalid.");
  try {
    const latest = quantity(await input.transport.request("eth_blockNumber", []), "latest block");
    if (latest < deploymentBlock) throw new SettlementEvidenceError("MALFORMED_EVIDENCE", "Latest block precedes the canonical deployment block.");
    const events: SettlementOrderEvent[] = [];
    const seen = new Set<string>();
    const eventTopics = SETTLEMENT_ORDER_EVENT_KINDS.map(eventTopic);
    const indexedOrderTopic = orderTopic("OrderCreated", orderId);
    for (let from = deploymentBlock; from <= latest; from += chunkSize) {
      const to = from + chunkSize - 1n > latest ? latest : from + chunkSize - 1n;
      const result = await input.transport.request("eth_getLogs", [{ address: ARC_TESTNET.settlementEscrow.address, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics: [eventTopics, indexedOrderTopic] }]);
      if (!Array.isArray(result)) throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "eth_getLogs did not return an array");
      for (const raw of result) {
        try {
          const decoded = decodeSettlementOrderEvent(log(raw));
          if (decoded.orderId !== orderId) continue;
          const key = `${decoded.transactionHash}:${decoded.logIndex}`;
          if (!seen.has(key)) { seen.add(key); events.push(decoded); }
        } catch { warnings.push("One lifecycle log was unavailable or malformed."); }
      }
    }
    events.sort((a, b) => a.blockNumber === b.blockNumber ? (a.logIndex < b.logIndex ? -1 : a.logIndex > b.logIndex ? 1 : 0) : (a.blockNumber < b.blockNumber ? -1 : 1));
    const timeline = events.map(projectEvent).filter((entry): entry is OrderEvidenceTimelineEntry => "event" in entry);
    const settlementPayouts = events.map(projectEvent).filter((entry): entry is OrderEvidencePayout => "recipient" in entry);
    const observed = settlementPayouts.reduce((total, payout) => total + BigInt(payout.amountBaseUnits), 0n);
    return { orderId, canonicalStatus: canonical.projection.status, canonicalStatusLabel: orderStatusLabel(canonical.projection.status), timeline, settlementPayouts, summary: { expectedAmountBaseUnits: canonical.projection.totalAmountBaseUnits.toString(), expectedAmountUsdc: formatUsdcAmountFixed(canonical.projection.totalAmountBaseUnits), observedSettlementAmountBaseUnits: observed.toString(), observedSettlementAmountUsdc: formatUsdcAmountFixed(observed), payoutCount: settlementPayouts.length, payoutTotalMatches: settlementPayouts.length > 0 && observed === canonical.projection.totalAmountBaseUnits }, completeness: warnings.length === 0 ? "complete" : "partial", warnings };
  } catch (cause) {
    if (cause instanceof SettlementEvidenceError) throw cause;
    return {
      orderId,
      canonicalStatus: canonical.projection.status,
      canonicalStatusLabel: orderStatusLabel(canonical.projection.status),
      timeline: [],
      settlementPayouts: [],
      summary: {
        expectedAmountBaseUnits: canonical.projection.totalAmountBaseUnits.toString(),
        expectedAmountUsdc: formatUsdcAmountFixed(canonical.projection.totalAmountBaseUnits),
        observedSettlementAmountBaseUnits: "0",
        observedSettlementAmountUsdc: formatUsdcAmountFixed(0n),
        payoutCount: 0,
        payoutTotalMatches: false,
      },
      completeness: "partial",
      warnings: ["Onchain lifecycle evidence is temporarily unavailable."],
    };
  }
}