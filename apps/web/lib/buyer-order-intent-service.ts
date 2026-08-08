import {
  ARC_TESTNET, OrderStatus, createApproveUsdcPlan, createFundOrderPlan,
  createHttpSettlementRpcTransport, createSettlementEscrowReader, formatUsdcAmount,
  orderIdSchema, prepareBuyerTransactionIntent, orderStatusLabel,
  type BuyerTransactionIntent, type SettlementEscrowReader,
} from "@settle/shared";

export type BuyerOrderErrorCode = "MALFORMED_ORDER_ID" | "WRONG_CHAIN" | "UNKNOWN_ORDER" | "NON_CREATED_ORDER" | "EXPIRED_DEADLINE" | "RPC_FAILURE" | "MALFORMED_CHAIN_RESPONSE";
export class BuyerOrderError extends Error {
  readonly code: BuyerOrderErrorCode;
  constructor(code: BuyerOrderErrorCode, message: string) { super(message); this.name = "BuyerOrderError"; this.code = code; }
}

export type JsonIntent = Omit<BuyerTransactionIntent, "value" | "prerequisites"> & { value: "0"; prerequisites: readonly Record<string, unknown>[] };
export interface BuyerOrderResponse {
  orderId: string; status: string; statusLabel: string; buyer: string; amount: { baseUnits: string; usdc: string };
  fundingDeadline: string; fundingDeadlineOpen: boolean;
  allowance: { baseUnits: string; usdc: string };
  approveIntent: JsonIntent; fundIntent: JsonIntent; fundReady: boolean;
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

export async function loadBuyerOrder(input: { orderId: unknown }, dependencies: BuyerOrderDependencies): Promise<BuyerOrderResponse> {
  let orderId: string;
  try { orderId = orderIdSchema.parse(input.orderId); } catch { throw new BuyerOrderError("MALFORMED_ORDER_ID", "Order ID must be a bytes32 value."); }
  try {
    const result = await dependencies.reader.readSettlementOrder(orderId);
    if (result.kind === "unknown") throw new BuyerOrderError("UNKNOWN_ORDER", "The order does not exist.");
    const order = result.order;
    const now = dependencies.now?.() ?? BigInt(Math.floor(Date.now() / 1000));
    const open = order.fundingDeadline > now;
    if (order.status === OrderStatus.Created && !open) throw new BuyerOrderError("EXPIRED_DEADLINE", "The funding deadline has expired.");
    const allowance = await dependencies.reader.readUsdcAllowance(order.buyer, ARC_TESTNET.settlementEscrow.address);
    const stored = { orderId, buyer: order.buyer, totalAmount: order.totalAmount, status: OrderStatus.Created } as const;
    return { orderId, status: String(order.status), statusLabel: orderStatusLabel(order.status as OrderStatus), buyer: order.buyer, amount: { baseUnits: order.totalAmount.toString(), usdc: formatUsdcAmount(order.totalAmount) }, fundingDeadline: order.fundingDeadline.toString(), fundingDeadlineOpen: open, allowance: { baseUnits: allowance.toString(), usdc: formatUsdcAmount(allowance) }, approveIntent: jsonIntent(prepareBuyerTransactionIntent(createApproveUsdcPlan({ order: stored }))), fundIntent: jsonIntent(prepareBuyerTransactionIntent(createFundOrderPlan({ order: stored }))), fundReady: allowance >= order.totalAmount };
  } catch (cause) { throw safeError(cause); }
}

export function createBuyerOrderDependencies(rpcUrl: string): BuyerOrderDependencies {
  return { reader: createSettlementEscrowReader({ transport: createHttpSettlementRpcTransport(rpcUrl) }) };
}