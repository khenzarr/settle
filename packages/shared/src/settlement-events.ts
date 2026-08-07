import { decodeEventLog, type Hex } from "viem";

import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { DisputeResolution, type DisputeResolution as DisputeResolutionValue } from "./order.ts";
import {
  nonZeroEvmAddressSchema,
  normalizeAddress,
  orderIdSchema,
  termsHashSchema,
  transactionHashSchema,
  type EvmAddress,
  type OrderId,
  type TermsHash,
  type TransactionHash,
} from "./schemas.ts";
import { SettlementReadError } from "./settlement-read.ts";

export const SETTLEMENT_ORDER_EVENT_KINDS = [
  "OrderCreated",
  "OrderFunded",
  "SettlementPaid",
  "OrderReleased",
  "OrderRefunded",
  "OrderCancelled",
  "OrderDisputed",
  "DisputeResolved",
] as const;

export type SettlementOrderEventKind = (typeof SETTLEMENT_ORDER_EVENT_KINDS)[number];

export interface SettlementEventLog {
  transactionHash: string;
  blockNumber: bigint;
  logIndex: bigint;
  topics: readonly Hex[];
  data: Hex;
}

interface SettlementEventEvidence {
  transactionHash: TransactionHash;
  blockNumber: bigint;
  logIndex: bigint;
  orderId: OrderId;
}

export type SettlementOrderEvent =
  | (SettlementEventEvidence & { kind: "OrderCreated"; buyer: EvmAddress; totalAmount: bigint; fundingDeadline: bigint; settlementDeadline: bigint; termsHash: TermsHash })
  | (SettlementEventEvidence & { kind: "OrderFunded"; buyer: EvmAddress; fundedAmount: bigint; fundedAt: bigint })
  | (SettlementEventEvidence & { kind: "SettlementPaid"; recipient: EvmAddress; recipientAmount: bigint })
  | (SettlementEventEvidence & { kind: "OrderReleased"; buyer: EvmAddress; totalAmount: bigint; settledAt: bigint })
  | (SettlementEventEvidence & { kind: "OrderRefunded"; buyer: EvmAddress; refundedAmount: bigint; refundedAt: bigint })
  | (SettlementEventEvidence & { kind: "OrderCancelled"; caller: EvmAddress; buyer: EvmAddress; cancelledAt: bigint })
  | (SettlementEventEvidence & { kind: "OrderDisputed"; caller: EvmAddress; buyer: EvmAddress; disputedAt: bigint })
  | (SettlementEventEvidence & { kind: "DisputeResolved"; arbitrator: EvmAddress; resolution: DisputeResolutionValue; amount: bigint; resolvedAt: bigint });

function uint(value: unknown, field: string): bigint {
  if (typeof value !== "bigint" || value < 0n) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `${field} must be a non-negative bigint`);
  }
  return value;
}

function address(value: unknown): EvmAddress {
  return normalizeAddress(nonZeroEvmAddressSchema.parse(value)) as EvmAddress;
}

function resolution(value: unknown): DisputeResolutionValue {
  if (value !== DisputeResolution.Release && value !== DisputeResolution.Refund) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `Unsupported dispute resolution: ${String(value)}`);
  }
  return value;
}

export function decodeSettlementOrderEvent(log: SettlementEventLog): SettlementOrderEvent {
  let decoded: ReturnType<typeof decodeEventLog>;
  try {
    decoded = decodeEventLog({ abi: settlementEscrowAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data, strict: true });
  } catch (cause) {
    throw new SettlementReadError("ABI_DECODE_FAILURE", "Unable to decode SettlementEscrow lifecycle event", { cause });
  }

  if (!SETTLEMENT_ORDER_EVENT_KINDS.includes(decoded.eventName as SettlementOrderEventKind)) {
    throw new SettlementReadError("ABI_DECODE_FAILURE", `Unsupported SettlementEscrow event: ${decoded.eventName}`);
  }
  if (typeof decoded.args !== "object" || decoded.args === null) {
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", "SettlementEscrow event is missing decoded arguments");
  }

  const args = decoded.args as Record<string, unknown>;
  const evidence: SettlementEventEvidence = {
    transactionHash: transactionHashSchema.parse(log.transactionHash),
    blockNumber: uint(log.blockNumber, "blockNumber"),
    logIndex: uint(log.logIndex, "logIndex"),
    orderId: orderIdSchema.parse(args.orderId),
  };

  try {
    switch (decoded.eventName as SettlementOrderEventKind) {
      case "OrderCreated":
        return { ...evidence, kind: "OrderCreated", buyer: address(args.buyer), totalAmount: uint(args.totalAmount, "totalAmount"), fundingDeadline: uint(args.fundingDeadline, "fundingDeadline"), settlementDeadline: uint(args.settlementDeadline, "settlementDeadline"), termsHash: termsHashSchema.parse(args.termsHash) };
      case "OrderFunded":
        return { ...evidence, kind: "OrderFunded", buyer: address(args.buyer), fundedAmount: uint(args.fundedAmount, "fundedAmount"), fundedAt: uint(args.fundedAt, "fundedAt") };
      case "SettlementPaid":
        return { ...evidence, kind: "SettlementPaid", recipient: address(args.recipient), recipientAmount: uint(args.recipientAmount, "recipientAmount") };
      case "OrderReleased":
        return { ...evidence, kind: "OrderReleased", buyer: address(args.buyer), totalAmount: uint(args.totalAmount, "totalAmount"), settledAt: uint(args.settledAt, "settledAt") };
      case "OrderRefunded":
        return { ...evidence, kind: "OrderRefunded", buyer: address(args.buyer), refundedAmount: uint(args.refundedAmount, "refundedAmount"), refundedAt: uint(args.refundedAt, "refundedAt") };
      case "OrderCancelled":
        return { ...evidence, kind: "OrderCancelled", caller: address(args.caller), buyer: address(args.buyer), cancelledAt: uint(args.cancelledAt, "cancelledAt") };
      case "OrderDisputed":
        return { ...evidence, kind: "OrderDisputed", caller: address(args.caller), buyer: address(args.buyer), disputedAt: uint(args.disputedAt, "disputedAt") };
      case "DisputeResolved":
        return { ...evidence, kind: "DisputeResolved", arbitrator: address(args.arbitrator), resolution: resolution(args.resolution), amount: uint(args.amount, "amount"), resolvedAt: uint(args.resolvedAt, "resolvedAt") };
    }
  } catch (cause) {
    if (cause instanceof SettlementReadError) throw cause;
    throw new SettlementReadError("MALFORMED_RPC_RESPONSE", `Decoded ${decoded.eventName} event contains invalid fields`, { cause });
  }
}