import "server-only";

import {
  ARC_TESTNET,
  OrderStatus,
  createCreateOrderPlan,
  createReleaseOrderPlan,
  formatUsdcAmount,
  orderIdSchema,
  type SettlementEscrowReader,
} from "@settle/shared";
import {
  prepareOperatorSettlementDryRun,
  type OperatorSettlementDryRunPreparation,
} from "@settle/circle";

export type OperatorActionRequest =
  | {
      readonly operation: "create-order";
      readonly orderId: string;
      readonly buyer: string;
      readonly totalAmountUsdc: string;
      readonly fundingDeadline: string;
      readonly settlementDeadline: string;
      readonly termsHash: string;
      readonly splits: readonly { readonly recipient: string; readonly shareBps: number }[];
    }
  | { readonly operation: "release-order"; readonly orderId: string };

export type OperatorActionErrorCode =
  | "invalid-request"
  | "unknown-order"
  | "invalid-order-state"
  | "operator-unavailable"
  | "configuration-error"
  | "canonical-state-error"
  | "dry-run-preparation-error";

export class OperatorActionError extends Error {
  readonly code: OperatorActionErrorCode;
  readonly status: 400 | 404 | 409 | 500 | 503;

  constructor(code: OperatorActionErrorCode, message: string, status: 400 | 404 | 409 | 500 | 503) {
    super(message);
    this.name = "OperatorActionError";
    this.code = code;
    this.status = status;
  }
}

export interface OperatorActionDependencies {
  readonly reader: SettlementEscrowReader;
  readonly operatorAddress: string;
  readonly circleWalletAddress: string;
  readonly now?: () => bigint;
  readonly prepareDryRun?: typeof prepareOperatorSettlementDryRun;
}

export interface OperatorActionResponse {
  readonly operation: "create-order" | "release-order";
  readonly mode: "dry-run";
  readonly blockchain: typeof ARC_TESTNET.name;
  readonly contract: string;
  readonly function: string;
  readonly orderId: string;
  readonly executionRequired: false;
  readonly operator: string;
  readonly buyer?: string;
  readonly amount?: { readonly baseUnits: string; readonly usdc: string };
  readonly recipientCount?: number;
  readonly settlementSplits?: readonly { readonly recipient: string; readonly shareBps: number; readonly amountBaseUnits: string }[];
}

const forbiddenKeys = new Set(["target", "targetAddress", "contract", "contractAddress", "abi", "abiFunctionSignature", "calldata", "execute", "idempotencyKey", "retry", "walletId"]);

function objectInput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new OperatorActionError("invalid-request", "Request must be a product operator action object.", 400);
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => forbiddenKeys.has(key))) throw new OperatorActionError("invalid-request", "Request contains an unsupported operator field.", 400);
  return object;
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new OperatorActionError("invalid-request", `${field} is required.`, 400);
  return value;
}

function parseRequest(value: unknown): OperatorActionRequest {
  const object = objectInput(value);
  if (object.operation === "release-order") {
    if (Object.keys(object).length !== 2) throw new OperatorActionError("invalid-request", "Release planning accepts only operation and orderId.", 400);
    return { operation: "release-order", orderId: stringField(object.orderId, "orderId") };
  }
  if (object.operation !== "create-order") throw new OperatorActionError("invalid-request", "Only create-order and release-order are supported.", 400);
  const splits = object.splits;
  if (!Array.isArray(splits)) throw new OperatorActionError("invalid-request", "splits is required.", 400);
  if (Object.keys(object).length !== 8) throw new OperatorActionError("invalid-request", "Create planning received an unexpected field.", 400);
  return {
    operation: "create-order",
    orderId: stringField(object.orderId, "orderId"),
    buyer: stringField(object.buyer, "buyer"),
    totalAmountUsdc: stringField(object.totalAmountUsdc, "totalAmountUsdc"),
    fundingDeadline: stringField(object.fundingDeadline, "fundingDeadline"),
    settlementDeadline: stringField(object.settlementDeadline, "settlementDeadline"),
    termsHash: stringField(object.termsHash, "termsHash"),
    splits: splits.map((split) => {
      if (typeof split !== "object" || split === null || Array.isArray(split)) throw new OperatorActionError("invalid-request", "Each split must be an object.", 400);
      const item = split as Record<string, unknown>;
      if (Object.keys(item).length !== 2 || typeof item.recipient !== "string" || typeof item.shareBps !== "number") throw new OperatorActionError("invalid-request", "Each split must contain recipient and shareBps.", 400);
      return { recipient: item.recipient, shareBps: item.shareBps };
    }),
  };
}

function safePreparation(preparation: OperatorSettlementDryRunPreparation): OperatorSettlementDryRunPreparation {
  if (preparation.executionRequired !== false || preparation.contractAddress.toLowerCase() !== ARC_TESTNET.settlementEscrow.address.toLowerCase()) throw new OperatorActionError("canonical-state-error", "Operator preparation was not canonical.", 500);
  return preparation;
}

function mapPreparation(input: OperatorActionRequest, preparation: OperatorSettlementDryRunPreparation, extra: Omit<OperatorActionResponse, "operation" | "mode" | "blockchain" | "contract" | "function" | "orderId" | "executionRequired" | "operator">): OperatorActionResponse {
  const safe = safePreparation(preparation);
  return { operation: input.operation, mode: "dry-run", blockchain: ARC_TESTNET.name, contract: safe.contractAddress, function: safe.abiFunctionSignature, orderId: input.orderId, executionRequired: false, operator: safe.operatorSigner, ...extra };
}

export async function planOperatorAction(input: unknown, dependencies: OperatorActionDependencies): Promise<OperatorActionResponse> {
  const request = parseRequest(input);
  const prepare = dependencies.prepareDryRun ?? prepareOperatorSettlementDryRun;
  try {
    if (request.operation === "create-order") {
      const now = dependencies.now?.() ?? BigInt(Math.floor(Date.now() / 1000));
      const plan = createCreateOrderPlan({
        operatorAddress: dependencies.operatorAddress,
        currentTimestamp: now,
        orderId: request.orderId,
        buyer: request.buyer,
        totalAmountUsdc: request.totalAmountUsdc,
        fundingDeadline: BigInt(request.fundingDeadline),
        settlementDeadline: BigInt(request.settlementDeadline),
        termsHash: request.termsHash,
        splits: request.splits,
      });
      const prepared = prepare({ plan, configuredWalletAddress: dependencies.circleWalletAddress, configuredOperatorAddress: dependencies.operatorAddress });
      return mapPreparation(request, prepared, { buyer: plan.abiParameters[1], amount: { baseUnits: plan.abiParameters[2].toString(), usdc: formatUsdcAmount(plan.abiParameters[2]) }, recipientCount: plan.abiParameters[6].length, settlementSplits: plan.abiParameters[6].map((recipient, index) => ({ recipient, shareBps: plan.abiParameters[7][index]!, amountBaseUnits: ((plan.abiParameters[2] * BigInt(plan.abiParameters[7][index]!)) / 10_000n).toString() })) });
    }
    const orderId = orderIdSchema.parse(request.orderId);
    const orderResult = await dependencies.reader.readSettlementOrder(orderId);
    if (orderResult.kind === "unknown") throw new OperatorActionError("unknown-order", "The order does not exist.", 404);
    if (orderResult.order.status !== OrderStatus.Funded) throw new OperatorActionError("invalid-order-state", "Only Funded orders can be prepared for operator release.", 409);
    const splitsResult = await dependencies.reader.readSettlementSplits(orderId);
    if (splitsResult.kind === "unknown") throw new OperatorActionError("canonical-state-error", "Settlement splits are missing for the canonical order.", 500);
    const plan = createReleaseOrderPlan({ operatorAddress: dependencies.operatorAddress, order: { orderId, buyer: orderResult.order.buyer, totalAmount: orderResult.order.totalAmount, status: OrderStatus.Funded }, splits: splitsResult.splits });
    const prepared = prepare({ plan, configuredWalletAddress: dependencies.circleWalletAddress, configuredOperatorAddress: dependencies.operatorAddress });
    return mapPreparation(request, prepared, { buyer: orderResult.order.buyer, amount: { baseUnits: orderResult.order.totalAmount.toString(), usdc: formatUsdcAmount(orderResult.order.totalAmount) }, recipientCount: splitsResult.splits.length });
  } catch (cause) {
    if (cause instanceof OperatorActionError) throw cause;
    throw new OperatorActionError("dry-run-preparation-error", "Unable to prepare the operator dry-run.", 503);
  }
}
