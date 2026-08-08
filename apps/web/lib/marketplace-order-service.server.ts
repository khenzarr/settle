import "server-only";

import { ARC_TESTNET, SettlementReadError, createHttpSettlementRpcTransport, createSettlementEscrowReader, orderIdSchema, parseArcTestnetRpcUrl, projectMarketplaceOrder, readOrderEvidence, type MarketplaceOrderView, type OrderEvidence, type SettlementOrderProjection } from "@settle/shared";

export type MarketplaceOrderServiceErrorCode = "invalid-order-id" | "unknown-order" | "wrong-chain" | "rpc-unavailable" | "malformed-chain-data";

export class MarketplaceOrderServiceError extends Error {
  readonly code: MarketplaceOrderServiceErrorCode;
  constructor(code: MarketplaceOrderServiceErrorCode, message: string) { super(message); this.name = "MarketplaceOrderServiceError"; this.code = code; }
}

export interface MarketplaceOrderDependencies {
  readOrder(orderId: string): Promise<{ kind: "known"; projection: SettlementOrderProjection } | { kind: "unknown" }>;
  readEvidence(orderId: string): Promise<OrderEvidence>;
  now(): bigint;
}

function mapReadError(cause: unknown): MarketplaceOrderServiceError {
  if (cause instanceof MarketplaceOrderServiceError) return cause;
  if (cause instanceof SettlementReadError) {
    if (cause.code === "WRONG_CHAIN") return new MarketplaceOrderServiceError("wrong-chain", "The configured RPC is not Arc Testnet.");
    if (cause.code === "MALFORMED_RPC_RESPONSE" || cause.code === "ABI_DECODE_FAILURE" || cause.code === "INVALID_SPLITS" || cause.code === "UNSUPPORTED_STATUS") return new MarketplaceOrderServiceError("malformed-chain-data", "The canonical order data is malformed or unsupported.");
  }
  return new MarketplaceOrderServiceError("rpc-unavailable", "Canonical order state is temporarily unavailable.");
}

export async function loadMarketplaceOrder(orderIdInput: unknown, dependencies: MarketplaceOrderDependencies): Promise<MarketplaceOrderView> {
  let orderId: string;
  try { orderId = orderIdSchema.parse(orderIdInput); } catch { throw new MarketplaceOrderServiceError("invalid-order-id", "Order ID must be a nonzero bytes32 value."); }
  let result: Awaited<ReturnType<MarketplaceOrderDependencies["readOrder"]>>;
  try { result = await dependencies.readOrder(orderId); } catch (cause) { throw mapReadError(cause); }
  if (result.kind === "unknown") throw new MarketplaceOrderServiceError("unknown-order", "The order does not exist.");
  try {
    const evidence = await dependencies.readEvidence(orderId);
    return projectMarketplaceOrder({ order: result.projection, now: dependencies.now(), evidence });
  } catch {
    return projectMarketplaceOrder({ order: result.projection, now: dependencies.now(), evidenceWarning: "Onchain lifecycle evidence is temporarily unavailable." });
  }
}

export function createMarketplaceOrderDependencies(): MarketplaceOrderDependencies {
  const transport = createHttpSettlementRpcTransport(parseArcTestnetRpcUrl(process.env));
  const reader = createSettlementEscrowReader({ transport });
  return {
    readOrder: (orderId) => reader.readSettlementOrderProjection(orderId),
    readEvidence: (orderId) => readOrderEvidence({ transport, reader, orderId, deploymentBlock: ARC_TESTNET.settlementEscrow.deploymentBlock }),
    now: () => BigInt(Math.floor(Date.now() / 1000)),
  };
}
