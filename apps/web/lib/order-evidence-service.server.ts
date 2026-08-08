import "server-only";

import { ARC_TESTNET, createHttpSettlementRpcTransport, createSettlementEscrowReader, readOrderEvidence, SettlementEvidenceError, parseArcTestnetRpcUrl, type OrderEvidence } from "@settle/shared";

export type OrderEvidenceServiceErrorCode = "INVALID_ORDER_ID" | "UNKNOWN_ORDER" | "WRONG_CHAIN" | "EVIDENCE_UNAVAILABLE" | "MALFORMED_EVIDENCE";

export class OrderEvidenceServiceError extends Error {
  readonly code: OrderEvidenceServiceErrorCode;
  constructor(code: OrderEvidenceServiceErrorCode, message: string) { super(message); this.name = "OrderEvidenceServiceError"; this.code = code; }
}

export interface OrderEvidenceDependencies { read: (orderId: unknown) => Promise<OrderEvidence>; }

function mapError(cause: unknown): OrderEvidenceServiceError {
  if (cause instanceof OrderEvidenceServiceError) return cause;
  if (cause instanceof SettlementEvidenceError) return new OrderEvidenceServiceError(cause.code, cause.message);
  return new OrderEvidenceServiceError("EVIDENCE_UNAVAILABLE", "Onchain lifecycle evidence is temporarily unavailable.");
}

export async function loadOrderEvidence(orderId: unknown, dependencies: OrderEvidenceDependencies): Promise<OrderEvidence> {
  try { return await dependencies.read(orderId); } catch (cause) { throw mapError(cause); }
}

export function createOrderEvidenceDependencies(): OrderEvidenceDependencies {
  const transport = createHttpSettlementRpcTransport(parseArcTestnetRpcUrl(process.env));
  const reader = createSettlementEscrowReader({ transport });
  return { read: (orderId) => readOrderEvidence({ transport, reader, orderId, deploymentBlock: ARC_TESTNET.settlementEscrow.deploymentBlock }) };
}