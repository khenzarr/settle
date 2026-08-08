import {
  ARC_TESTNET, OrderStatus, createHttpSettlementRpcTransport, createSettlementEscrowReader,
  getExplorerTransactionUrl, orderIdSchema, parseArcTestnetRpcUrl, transactionHashSchema,
  type SettlementEscrowReader,
} from "@settle/shared";

export type BuyerConfirmationOperation = "approve-usdc" | "fund-order" | "cancel-expired-order" | "raise-dispute";
export type BuyerConfirmationStatus = "pending" | "reverted" | "included-awaiting-state" | "state-confirmed";
export interface BuyerConfirmationInput { orderId: unknown; transactionHash: unknown; operation: unknown }
export interface BuyerConfirmationResponse {
  orderId: string; transactionHash: string; operation: BuyerConfirmationOperation;
  confirmationStatus: BuyerConfirmationStatus;
  receipt: { blockNumber: string; from: string; to: string } | null;
  orderStatus?: string; allowance?: string; requiredAmount?: string;
  stateConfirmed: boolean; arcScanUrl: string;
}
export type BuyerConfirmationErrorCode = "MALFORMED_INPUT" | "UNKNOWN_ORDER" | "IDENTITY_MISMATCH" | "READ_FAILURE";
export class BuyerConfirmationError extends Error {
  readonly code: BuyerConfirmationErrorCode;
  constructor(code: BuyerConfirmationErrorCode, message: string) { super(message); this.name = "BuyerConfirmationError"; this.code = code; }
}

export interface BuyerConfirmationDependencies { reader: SettlementEscrowReader }
export interface ConfirmationPollingOptions { maxAttempts?: number; delayMs?: number; delay?: (ms: number) => Promise<void> }

function inputOf(input: BuyerConfirmationInput): { orderId: string; transactionHash: string; operation: BuyerConfirmationOperation } {
  try {
    const operation = input.operation === "approve-usdc" || input.operation === "fund-order" || input.operation === "cancel-expired-order" || input.operation === "raise-dispute" ? input.operation : null;
    if (!operation) throw new Error();
    return { orderId: orderIdSchema.parse(input.orderId), transactionHash: transactionHashSchema.parse(input.transactionHash).toLowerCase(), operation };
  } catch { throw new BuyerConfirmationError("MALFORMED_INPUT", "orderId, transactionHash, and operation are required and valid."); }
}

export async function confirmBuyerTransaction(input: BuyerConfirmationInput, { reader }: BuyerConfirmationDependencies): Promise<BuyerConfirmationResponse> {
  const parsed = inputOf(input);
  try {
    const orderResult = await reader.readSettlementOrder(parsed.orderId);
    if (orderResult.kind === "unknown") throw new BuyerConfirmationError("UNKNOWN_ORDER", "The order does not exist.");
    const order = orderResult.order;
    if (!reader.readTransactionReceipt) throw new BuyerConfirmationError("READ_FAILURE", "Receipt confirmation is not available.");
    const receipt = await reader.readTransactionReceipt(parsed.transactionHash);
    if (!receipt) return { ...parsed, confirmationStatus: "pending", receipt: null, stateConfirmed: false, arcScanUrl: getExplorerTransactionUrl(parsed.transactionHash as `0x${string}`) };
    if (parsed.operation !== "cancel-expired-order" && receipt.from.toLowerCase() !== order.buyer.toLowerCase()) throw new BuyerConfirmationError("IDENTITY_MISMATCH", "Receipt sender does not match the canonical order buyer.");
    const expectedTo = parsed.operation === "approve-usdc" ? ARC_TESTNET.usdc.address : ARC_TESTNET.settlementEscrow.address;
    if (receipt.to.toLowerCase() !== expectedTo.toLowerCase()) throw new BuyerConfirmationError("IDENTITY_MISMATCH", "Receipt target does not match the canonical operation target.");
    const evidence = { blockNumber: receipt.blockNumber.toString(), from: receipt.from, to: receipt.to };
    const base = { ...parsed, receipt: evidence, arcScanUrl: getExplorerTransactionUrl(parsed.transactionHash as `0x${string}`) };
    if (receipt.status === 0) return { ...base, confirmationStatus: "reverted", stateConfirmed: false };
    if (parsed.operation === "approve-usdc") {
      const allowance = await reader.readUsdcAllowance(order.buyer, ARC_TESTNET.settlementEscrow.address);
      const confirmed = allowance >= order.totalAmount;
      return { ...base, confirmationStatus: confirmed ? "state-confirmed" : "included-awaiting-state", allowance: allowance.toString(), requiredAmount: order.totalAmount.toString(), stateConfirmed: confirmed };
    }
    const current = await reader.readSettlementOrder(parsed.orderId);
    if (current.kind === "unknown") throw new BuyerConfirmationError("UNKNOWN_ORDER", "The order does not exist.");
    const expectedStatus = parsed.operation === "fund-order" ? OrderStatus.Funded : parsed.operation === "cancel-expired-order" ? OrderStatus.Cancelled : OrderStatus.Disputed;
    const confirmed = current.order.status === expectedStatus;
    return { ...base, confirmationStatus: confirmed ? "state-confirmed" : "included-awaiting-state", orderStatus: String(current.order.status), stateConfirmed: confirmed };
  } catch (cause) {
    if (cause instanceof BuyerConfirmationError) throw cause;
    throw new BuyerConfirmationError("READ_FAILURE", "Unable to confirm the buyer transaction from Arc Testnet.");
  }
}

export async function confirmWithBoundedPolling(input: BuyerConfirmationInput, dependencies: BuyerConfirmationDependencies, options: ConfirmationPollingOptions = {}): Promise<BuyerConfirmationResponse> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 6));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? 2_000));
  const delay = options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let response = await confirmBuyerTransaction(input, dependencies);
  for (let attempt = 1; attempt < maxAttempts && response.confirmationStatus !== "state-confirmed" && response.confirmationStatus !== "reverted"; attempt += 1) {
    await delay(delayMs);
    response = await confirmBuyerTransaction(input, dependencies);
  }
  return response;
}

export function createBuyerConfirmationDependencies(rpcUrl: string): BuyerConfirmationDependencies {
  return { reader: createSettlementEscrowReader({ transport: createHttpSettlementRpcTransport(rpcUrl) }) };
}
export function createConfiguredBuyerConfirmationDependencies(): BuyerConfirmationDependencies { return createBuyerConfirmationDependencies(parseArcTestnetRpcUrl(process.env)); }