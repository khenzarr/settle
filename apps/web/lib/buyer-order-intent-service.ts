import {
  ARC_TESTNET, OrderStatus, createApproveUsdcPlan, createCancelExpiredOrderPlan, createFundOrderPlan, createRaiseDisputePlan,
  createHttpSettlementRpcTransport, createSettlementEscrowReader, formatUsdcAmount,
  orderIdSchema, prepareBuyerTransactionIntent, orderStatusLabel,
  type BuyerTransactionIntent, type SettlementEscrowReader,
} from "@settle/shared";

export type BuyerOrderErrorCode = "MALFORMED_ORDER_ID" | "WRONG_CHAIN" | "UNKNOWN_ORDER" | "RPC_FAILURE" | "MALFORMED_CHAIN_RESPONSE";
export class BuyerOrderError extends Error {
  readonly code: BuyerOrderErrorCode;
  constructor(code: BuyerOrderErrorCode, message: string) { super(message); this.name = "BuyerOrderError"; this.code = code; }
}

export type JsonIntent = Omit<BuyerTransactionIntent, "value" | "prerequisites"> & { value: "0"; prerequisites: readonly Record<string, unknown>[] };
export interface BuyerOrderResponse {
  orderId: string; status: string; statusLabel: string; buyer: string; amount: { baseUnits: string; usdc: string };
  fundingDeadline: string; fundingDeadlineOpen: boolean; fundingDeadlineExpired: boolean;
  allowance: { baseUnits: string; usdc: string };
  approveIntent: JsonIntent | null; fundIntent: JsonIntent | null; cancelIntent: JsonIntent | null; disputeIntent: JsonIntent | null; fundReady: boolean;
}
export interface BuyerOrderDependencies { reader: SettlementEscrowReader; now?: () => bigint; }

function jsonIntent(intent: BuyerTransactionIntent): JsonIntent {
  return { ...intent, value: "0", prerequisites: intent.prerequisites.map((item) => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]))) };
}
function safeError(cause: unknown): BuyerOrderError {
  if (cause instanceof BuyerOrderError) return cause;
  const code = (cause as { code?: string } | null)?.code;
  if (code === "WRONG_CHAIN") return new BuyerOrderError("WRONG_CHAIN", "The configured RPC is not Arc Testnet.");
  if (code === "MALFORMED_RPC_RESPONSE" || code === "ABI_DECODE_FAILURE" || code === "UNSUPPORTED_STATUS") return new BuyerOrderError("MALFORMED_CHAIN_RESPONSE", "Arc Testnet returned an invalid chain response.");
  return new BuyerOrderError("RPC_FAILURE", "Unable to read the order from Arc Testnet.");
}

export async function loadBuyerOrder(input: { orderId: unknown; callerAddress?: unknown }, dependencies: BuyerOrderDependencies): Promise<BuyerOrderResponse> {
  let orderId: string;
  try { orderId = orderIdSchema.parse(input.orderId); } catch { throw new BuyerOrderError("MALFORMED_ORDER_ID", "Order ID must be a bytes32 value."); }
  try {
    const result = await dependencies.reader.readSettlementOrder(orderId);
    if (result.kind === "unknown") throw new BuyerOrderError("UNKNOWN_ORDER", "The order does not exist.");
    const order = result.order;
    const now = dependencies.now?.() ?? BigInt(Math.floor(Date.now() / 1000));
    const open = order.fundingDeadline > now;
    const expired = now > order.fundingDeadline;
    const allowance = await dependencies.reader.readUsdcAllowance(order.buyer, ARC_TESTNET.settlementEscrow.address);
    const stored = { orderId, buyer: order.buyer, totalAmount: order.totalAmount, status: order.status as OrderStatus } as const;
    const callerAddress = typeof input.callerAddress === "string" ? input.callerAddress : null;
    const created = order.status === OrderStatus.Created;
    const funded = order.status === OrderStatus.Funded;
    const buyerDispute = funded && callerAddress?.toLowerCase() === order.buyer.toLowerCase();
    const cancel = created && expired && callerAddress ? jsonIntent(prepareBuyerTransactionIntent(createCancelExpiredOrderPlan({ callerAddress, currentTimestamp: now, fundingDeadline: order.fundingDeadline, order: stored }))) : null;
    return { orderId, status: String(order.status), statusLabel: orderStatusLabel(order.status as OrderStatus), buyer: order.buyer, amount: { baseUnits: order.totalAmount.toString(), usdc: formatUsdcAmount(order.totalAmount) }, fundingDeadline: order.fundingDeadline.toString(), fundingDeadlineOpen: open, fundingDeadlineExpired: expired, allowance: { baseUnits: allowance.toString(), usdc: formatUsdcAmount(allowance) }, approveIntent: created && open ? jsonIntent(prepareBuyerTransactionIntent(createApproveUsdcPlan({ order: { ...stored, status: OrderStatus.Created } }))) : null, fundIntent: created && open ? jsonIntent(prepareBuyerTransactionIntent(createFundOrderPlan({ order: { ...stored, status: OrderStatus.Created } }))) : null, cancelIntent: cancel, disputeIntent: buyerDispute ? jsonIntent(prepareBuyerTransactionIntent(createRaiseDisputePlan({ callerKind: "buyer", callerAddress: callerAddress!, order: { ...stored, status: OrderStatus.Funded } }))) : null, fundReady: created && open && allowance >= order.totalAmount };
  } catch (cause) { throw safeError(cause); }
}

export function createBuyerOrderDependencies(rpcUrl: string): BuyerOrderDependencies {
  return { reader: createSettlementEscrowReader({ transport: createHttpSettlementRpcTransport(rpcUrl) }) };
}