import { z } from "zod";

import { ARC_TESTNET } from "./chains.ts";
import { formatUsdcAmount, parseUsdcAmount } from "./money.ts";
import {
  OrderStatus,
  parseOrderStatus,
  validateOrderCreationAt,
  type OrderStatus as OrderStatusValue,
} from "./order.ts";
import {
  nonZeroEvmAddressSchema,
  normalizeAddress,
  orderIdSchema,
  type EvmAddress,
  type OrderId,
  type TermsHash,
} from "./schemas.ts";
import {
  calculateSettlementPayouts,
  validateSettlementSplits,
  type SettlementSplit,
} from "./settlement.ts";

export const MARKETPLACE_COMMAND_ABI_SIGNATURES = {
  createOrder: "createOrder(bytes32,address,uint256,uint256,uint256,bytes32,address[],uint16[])",
  approveUsdc: "approve(address,uint256)",
  fundOrder: "fundOrder(bytes32)",
  releaseOrder: "releaseOrder(bytes32)",
} as const;

export const MarketplaceSignerKind = {
  Operator: "operator",
  Buyer: "buyer",
} as const;

export type MarketplaceSignerKind = (typeof MarketplaceSignerKind)[keyof typeof MarketplaceSignerKind];
export type MarketplaceOperationKind = "create-order" | "approve-usdc" | "fund-order" | "release-order";

export interface MarketplaceSignerRequirement {
  readonly kind: MarketplaceSignerKind;
  readonly address: EvmAddress;
}

export interface MarketplaceCommandChain {
  readonly environment: typeof ARC_TESTNET.environment;
  readonly name: typeof ARC_TESTNET.name;
  readonly chainId: typeof ARC_TESTNET.chainId;
}

export type MarketplaceCommandPrerequisite =
  | { readonly kind: "operator-role"; readonly address: EvmAddress }
  | { readonly kind: "order-absent"; readonly orderId: OrderId }
  | { readonly kind: "order-status"; readonly orderId: OrderId; readonly status: OrderStatusValue }
  | {
      readonly kind: "exact-usdc-allowance";
      readonly owner: EvmAddress;
      readonly spender: EvmAddress;
      readonly amount: bigint;
    };

export type MarketplaceStateTransition =
  | { readonly system: "settlement-escrow"; readonly from: OrderStatusValue; readonly to: OrderStatusValue }
  | { readonly system: "erc20-allowance"; readonly from: null; readonly to: null };

export type MarketplaceUsdcEffect =
  | { readonly kind: "none"; readonly amount: 0n }
  | {
      readonly kind: "allowance-set";
      readonly owner: EvmAddress;
      readonly spender: EvmAddress;
      readonly amount: bigint;
    }
  | {
      readonly kind: "escrow-funded";
      readonly from: EvmAddress;
      readonly to: EvmAddress;
      readonly amount: bigint;
      readonly mechanism: "SettlementEscrow fundOrder transferFrom";
    }
  | {
      readonly kind: "split-payout";
      readonly from: EvmAddress;
      readonly totalAmount: bigint;
      readonly payouts: readonly {
        readonly recipient: EvmAddress;
        readonly shareBps: number;
        readonly amount: bigint;
      }[];
      readonly mechanism: "SettlementEscrow releaseOrder";
    };

interface MarketplaceCommandPlanBase {
  readonly operation: MarketplaceOperationKind;
  readonly chain: MarketplaceCommandChain;
  readonly targetAddress: EvmAddress;
  readonly abiFunctionSignature: string;
  readonly expectedSigner: MarketplaceSignerRequirement;
  readonly summary: string;
  readonly prerequisites: readonly MarketplaceCommandPrerequisite[];
  readonly expectedStateTransition: MarketplaceStateTransition;
  readonly expectedUsdcEffect: MarketplaceUsdcEffect;
  readonly changesChainState: true;
}

export interface CreateOrderCommandPlan extends MarketplaceCommandPlanBase {
  readonly operation: "create-order";
  readonly abiFunctionSignature: typeof MARKETPLACE_COMMAND_ABI_SIGNATURES.createOrder;
  readonly abiParameters: readonly [
    orderId: OrderId,
    buyer: EvmAddress,
    totalAmount: bigint,
    fundingDeadline: bigint,
    settlementDeadline: bigint,
    termsHash: TermsHash,
    recipients: readonly EvmAddress[],
    shares: readonly number[],
  ];
  readonly expectedSigner: MarketplaceSignerRequirement & { readonly kind: "operator" };
  readonly expectedUsdcEffect: Extract<MarketplaceUsdcEffect, { kind: "none" }>;
}

export interface ApproveUsdcCommandPlan extends MarketplaceCommandPlanBase {
  readonly operation: "approve-usdc";
  readonly abiFunctionSignature: typeof MARKETPLACE_COMMAND_ABI_SIGNATURES.approveUsdc;
  readonly abiParameters: readonly [spender: EvmAddress, amount: bigint];
  readonly expectedSigner: MarketplaceSignerRequirement & { readonly kind: "buyer" };
  readonly expectedUsdcEffect: Extract<MarketplaceUsdcEffect, { kind: "allowance-set" }>;
}

export interface FundOrderCommandPlan extends MarketplaceCommandPlanBase {
  readonly operation: "fund-order";
  readonly abiFunctionSignature: typeof MARKETPLACE_COMMAND_ABI_SIGNATURES.fundOrder;
  readonly abiParameters: readonly [orderId: OrderId];
  readonly expectedSigner: MarketplaceSignerRequirement & { readonly kind: "buyer" };
  readonly expectedUsdcEffect: Extract<MarketplaceUsdcEffect, { kind: "escrow-funded" }>;
}

export interface ReleaseOrderCommandPlan extends MarketplaceCommandPlanBase {
  readonly operation: "release-order";
  readonly abiFunctionSignature: typeof MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder;
  readonly abiParameters: readonly [orderId: OrderId];
  readonly expectedSigner: MarketplaceSignerRequirement & { readonly kind: "operator" };
  readonly expectedUsdcEffect: Extract<MarketplaceUsdcEffect, { kind: "split-payout" }>;
}

export type MarketplaceCommandPlan =
  | CreateOrderCommandPlan
  | ApproveUsdcCommandPlan
  | FundOrderCommandPlan
  | ReleaseOrderCommandPlan;

export interface CreateOrderPlanInput {
  readonly operatorAddress: string;
  readonly currentTimestamp: bigint;
  readonly orderId: string;
  readonly buyer: string;
  readonly totalAmountUsdc: string;
  readonly fundingDeadline: bigint;
  readonly settlementDeadline: bigint;
  readonly termsHash: string;
  readonly splits: readonly SettlementSplit[];
}

export interface MarketplaceStoredOrderInput {
  readonly orderId: string;
  readonly buyer: string;
  readonly totalAmount: bigint;
  readonly status: OrderStatusValue;
}

export interface ApproveUsdcPlanInput {
  readonly order: MarketplaceStoredOrderInput;
}

export interface FundOrderPlanInput {
  readonly order: MarketplaceStoredOrderInput;
}

export interface ReleaseOrderPlanInput {
  readonly operatorAddress: string;
  readonly order: MarketplaceStoredOrderInput;
  readonly splits: readonly SettlementSplit[];
}

const chain: MarketplaceCommandChain = Object.freeze({
  environment: ARC_TESTNET.environment,
  name: ARC_TESTNET.name,
  chainId: ARC_TESTNET.chainId,
});

const positiveAmountSchema = z.bigint().positive("Order total amount must be positive");

function address(value: string): EvmAddress {
  return normalizeAddress(nonZeroEvmAddressSchema.parse(value));
}

function storedOrder(input: MarketplaceStoredOrderInput, requiredStatus: OrderStatusValue): {
  orderId: OrderId;
  buyer: EvmAddress;
  totalAmount: bigint;
} {
  const status = parseOrderStatus(input.status);
  if (status !== requiredStatus) {
    throw new Error(`Order status must be ${requiredStatus}; received ${status}`);
  }
  return {
    orderId: orderIdSchema.parse(input.orderId),
    buyer: address(input.buyer),
    totalAmount: positiveAmountSchema.parse(input.totalAmount),
  };
}

export function createCreateOrderPlan(input: CreateOrderPlanInput): CreateOrderCommandPlan {
  const operator = address(input.operatorAddress);
  const validated = validateOrderCreationAt({
    orderId: input.orderId,
    buyer: input.buyer,
    totalAmount: parseUsdcAmount(input.totalAmountUsdc),
    fundingDeadline: input.fundingDeadline,
    settlementDeadline: input.settlementDeadline,
    termsHash: input.termsHash,
    splits: input.splits,
  }, input.currentTimestamp);
  const buyer = address(validated.buyer);
  const splits = validateSettlementSplits(validated.splits);

  return {
    operation: "create-order",
    chain,
    targetAddress: ARC_TESTNET.settlementEscrow.address,
    abiFunctionSignature: MARKETPLACE_COMMAND_ABI_SIGNATURES.createOrder,
    abiParameters: [
      validated.orderId,
      buyer,
      validated.totalAmount,
      validated.fundingDeadline,
      validated.settlementDeadline,
      validated.termsHash,
      splits.map((split) => split.recipient),
      splits.map((split) => split.shareBps),
    ],
    expectedSigner: { kind: MarketplaceSignerKind.Operator, address: operator },
    summary: `Operator ${operator} creates order ${validated.orderId} for buyer ${buyer} with ${formatUsdcAmount(validated.totalAmount)} USDC.`,
    prerequisites: [
      { kind: "operator-role", address: operator },
      { kind: "order-absent", orderId: validated.orderId },
    ],
    expectedStateTransition: { system: "settlement-escrow", from: OrderStatus.None, to: OrderStatus.Created },
    expectedUsdcEffect: { kind: "none", amount: 0n },
    changesChainState: true,
  };
}

export function createApproveUsdcPlan(input: ApproveUsdcPlanInput): ApproveUsdcCommandPlan {
  const order = storedOrder(input.order, OrderStatus.Created);
  const spender = ARC_TESTNET.settlementEscrow.address;

  return {
    operation: "approve-usdc",
    chain,
    targetAddress: ARC_TESTNET.usdc.address,
    abiFunctionSignature: MARKETPLACE_COMMAND_ABI_SIGNATURES.approveUsdc,
    abiParameters: [spender, order.totalAmount],
    expectedSigner: { kind: MarketplaceSignerKind.Buyer, address: order.buyer },
    summary: `Buyer ${order.buyer} approves SettlementEscrow to spend exactly ${formatUsdcAmount(order.totalAmount)} USDC for order ${order.orderId}.`,
    prerequisites: [{ kind: "order-status", orderId: order.orderId, status: OrderStatus.Created }],
    expectedStateTransition: { system: "erc20-allowance", from: null, to: null },
    expectedUsdcEffect: {
      kind: "allowance-set",
      owner: order.buyer,
      spender,
      amount: order.totalAmount,
    },
    changesChainState: true,
  };
}

export function createFundOrderPlan(input: FundOrderPlanInput): FundOrderCommandPlan {
  const order = storedOrder(input.order, OrderStatus.Created);
  const escrow = ARC_TESTNET.settlementEscrow.address;

  return {
    operation: "fund-order",
    chain,
    targetAddress: escrow,
    abiFunctionSignature: MARKETPLACE_COMMAND_ABI_SIGNATURES.fundOrder,
    abiParameters: [order.orderId],
    expectedSigner: { kind: MarketplaceSignerKind.Buyer, address: order.buyer },
    summary: `Buyer ${order.buyer} funds order ${order.orderId} with exactly ${formatUsdcAmount(order.totalAmount)} USDC through SettlementEscrow.`,
    prerequisites: [
      { kind: "order-status", orderId: order.orderId, status: OrderStatus.Created },
      {
        kind: "exact-usdc-allowance",
        owner: order.buyer,
        spender: escrow,
        amount: order.totalAmount,
      },
    ],
    expectedStateTransition: { system: "settlement-escrow", from: OrderStatus.Created, to: OrderStatus.Funded },
    expectedUsdcEffect: {
      kind: "escrow-funded",
      from: order.buyer,
      to: escrow,
      amount: order.totalAmount,
      mechanism: "SettlementEscrow fundOrder transferFrom",
    },
    changesChainState: true,
  };
}

export function createReleaseOrderPlan(input: ReleaseOrderPlanInput): ReleaseOrderCommandPlan {
  const operator = address(input.operatorAddress);
  const order = storedOrder(input.order, OrderStatus.Funded);
  const splits = validateSettlementSplits(input.splits);
  const amounts = calculateSettlementPayouts(order.totalAmount, splits);
  const escrow = ARC_TESTNET.settlementEscrow.address;

  return {
    operation: "release-order",
    chain,
    targetAddress: escrow,
    abiFunctionSignature: MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder,
    abiParameters: [order.orderId],
    expectedSigner: { kind: MarketplaceSignerKind.Operator, address: operator },
    summary: `Operator ${operator} releases order ${order.orderId}; SettlementEscrow pays ${formatUsdcAmount(order.totalAmount)} USDC across ${splits.length} recipient${splits.length === 1 ? "" : "s"}.`,
    prerequisites: [
      { kind: "operator-role", address: operator },
      { kind: "order-status", orderId: order.orderId, status: OrderStatus.Funded },
    ],
    expectedStateTransition: { system: "settlement-escrow", from: OrderStatus.Funded, to: OrderStatus.Completed },
    expectedUsdcEffect: {
      kind: "split-payout",
      from: escrow,
      totalAmount: order.totalAmount,
      payouts: splits.map((split, index) => ({ ...split, amount: amounts[index]! })),
      mechanism: "SettlementEscrow releaseOrder",
    },
    changesChainState: true,
  };
}