import { encodeFunctionData, type Hex } from "viem";

import { settlementEscrowAbi } from "./abi/SettlementEscrow.ts";
import { ARC_TESTNET } from "./chains.ts";
import {
  MARKETPLACE_COMMAND_ABI_SIGNATURES,
  MarketplaceSignerKind,
  type CancelExpiredOrderCommandPlan,
  type ApproveUsdcCommandPlan,
  type FundOrderCommandPlan,
  type RaiseDisputeCommandPlan,
  type MarketplaceCommandPrerequisite,
  type MarketplaceCommandPlan,
} from "./settlement-command-plan.ts";
import { nonZeroEvmAddressSchema, orderIdSchema, type EvmAddress } from "./schemas.ts";

const erc20Abi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

export interface BuyerTransactionIntent {
  readonly operation: "approve-usdc" | "fund-order" | "cancel-expired-order" | "raise-dispute";
  readonly chainId: typeof ARC_TESTNET.chainId;
  readonly from: EvmAddress;
  readonly to: EvmAddress;
  readonly data: Hex;
  readonly value: 0n;
  readonly expectedSigner: {
    readonly kind: "buyer" | "public";
    readonly address: EvmAddress;
  };
  readonly summary: string;
  readonly prerequisites: readonly MarketplaceCommandPrerequisite[];
}

function invalid(message: string): never {
  throw new TypeError(`Invalid buyer transaction intent source plan: ${message}`);
}

function canonicalAddress(value: unknown, field: string): EvmAddress {
  if (typeof value !== "string") invalid(`${field} must be an address`);
  try {
    return nonZeroEvmAddressSchema.parse(value).toLowerCase() as EvmAddress;
  } catch (cause) {
    throw new TypeError(`Invalid buyer transaction intent source plan: ${field} is malformed`, { cause });
  }
}

function abiAddress(value: EvmAddress): `0x${string}` {
  return value as `0x${string}`;
}

function abiBytes32(value: string): `0x${string}` {
  return value as `0x${string}`;
}

function immutablePrerequisites(prerequisites: readonly MarketplaceCommandPrerequisite[]): readonly MarketplaceCommandPrerequisite[] {
  return Object.freeze(prerequisites.map((prerequisite) => Object.freeze({ ...prerequisite })));
}

function requireBuyerPlan(plan: MarketplaceCommandPlan): ApproveUsdcCommandPlan | FundOrderCommandPlan | CancelExpiredOrderCommandPlan | RaiseDisputeCommandPlan {
  if (plan.operation !== "approve-usdc" && plan.operation !== "fund-order" && plan.operation !== "cancel-expired-order" && plan.operation !== "raise-dispute") {
    invalid("only approve-usdc, fund-order, cancel-expired-order, and raise-dispute plans are supported");
  }
  if (plan.chain.chainId !== ARC_TESTNET.chainId || plan.chain.environment !== ARC_TESTNET.environment || plan.chain.name !== ARC_TESTNET.name) {
    invalid("chain metadata is not canonical Arc Testnet");
  }
  if (plan.expectedSigner.kind !== MarketplaceSignerKind.Buyer && plan.expectedSigner.kind !== MarketplaceSignerKind.Public) {
    invalid("expected signer must be the buyer");
  }
  const signer = canonicalAddress(plan.expectedSigner.address, "transaction signer");
  if (signer !== plan.expectedSigner.address) invalid("transaction signer must be canonical");
  if (plan.changesChainState !== true || typeof plan.summary !== "string" || plan.summary.length === 0 || !Array.isArray(plan.prerequisites)) {
    invalid("plan metadata is malformed");
  }
  return plan;
}

export function prepareBuyerTransactionIntent(plan: MarketplaceCommandPlan): BuyerTransactionIntent {
  const buyerPlan = requireBuyerPlan(plan);
  const buyer = buyerPlan.expectedSigner.address;

  if (buyerPlan.operation === "approve-usdc") {
    if (buyerPlan.targetAddress !== ARC_TESTNET.usdc.address || buyerPlan.abiFunctionSignature !== MARKETPLACE_COMMAND_ABI_SIGNATURES.approveUsdc) {
      invalid("approval target or function signature is not canonical");
    }
    if (!Array.isArray(buyerPlan.abiParameters) || buyerPlan.abiParameters.length !== 2) invalid("approval parameters are malformed");
    const [spender, amount] = buyerPlan.abiParameters;
    if (spender !== ARC_TESTNET.settlementEscrow.address || typeof amount !== "bigint" || amount <= 0n) {
      invalid("approval spender or amount is not exact");
    }
    const effect = buyerPlan.expectedUsdcEffect;
    if (effect.kind !== "allowance-set" || effect.owner !== buyer || effect.spender !== spender || effect.amount !== amount) {
      invalid("approval parameters do not match the buyer allowance effect");
    }
    const prerequisites = immutablePrerequisites(buyerPlan.prerequisites);
    const intent: BuyerTransactionIntent = {
      operation: "approve-usdc",
      chainId: ARC_TESTNET.chainId,
      from: buyer,
      to: ARC_TESTNET.usdc.address,
      data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [abiAddress(spender), amount] }),
      value: 0n,
      expectedSigner: { kind: "buyer", address: buyer },
      summary: buyerPlan.summary,
      prerequisites,
    };
    return Object.freeze({ ...intent, expectedSigner: Object.freeze(intent.expectedSigner) });
  }

  if (buyerPlan.operation === "cancel-expired-order" || buyerPlan.operation === "raise-dispute") {
    if (buyerPlan.targetAddress !== ARC_TESTNET.settlementEscrow.address || buyerPlan.abiFunctionSignature !== MARKETPLACE_COMMAND_ABI_SIGNATURES[buyerPlan.operation === "cancel-expired-order" ? "cancelExpiredOrder" : "raiseDispute"]) invalid("lifecycle target or function signature is not canonical");
    if (!Array.isArray(buyerPlan.abiParameters) || buyerPlan.abiParameters.length !== 1) invalid("lifecycle parameters are malformed");
    const [orderId] = buyerPlan.abiParameters;
    try { orderIdSchema.parse(orderId); } catch (cause) { throw new TypeError("Invalid buyer transaction intent source plan: order ID is malformed", { cause }); }
    if (buyerPlan.operation === "raise-dispute" && buyerPlan.expectedSigner.kind !== MarketplaceSignerKind.Buyer) invalid("browser dispute intent must use the stored buyer signer");
    const signerKind: "buyer" | "public" = buyerPlan.operation === "raise-dispute" ? "buyer" : "public";
    const intent: BuyerTransactionIntent = {
      operation: buyerPlan.operation,
      chainId: ARC_TESTNET.chainId,
      from: buyer,
      to: ARC_TESTNET.settlementEscrow.address,
      data: encodeFunctionData({ abi: settlementEscrowAbi, functionName: buyerPlan.operation === "cancel-expired-order" ? "cancelExpiredOrder" : "raiseDispute", args: [abiBytes32(orderId)] }),
      value: 0n,
      expectedSigner: { kind: signerKind, address: buyer },
      summary: buyerPlan.summary,
      prerequisites: immutablePrerequisites(buyerPlan.prerequisites),
    };
    return Object.freeze({ ...intent, expectedSigner: Object.freeze(intent.expectedSigner) });
  }

  if (buyerPlan.targetAddress !== ARC_TESTNET.settlementEscrow.address || buyerPlan.abiFunctionSignature !== MARKETPLACE_COMMAND_ABI_SIGNATURES.fundOrder) {
    invalid("fund target or function signature is not canonical");
  }
  if (!Array.isArray(buyerPlan.abiParameters) || buyerPlan.abiParameters.length !== 1) invalid("fund parameters are malformed");
  const [orderId] = buyerPlan.abiParameters;
  try {
    orderIdSchema.parse(orderId);
  } catch (cause) {
    throw new TypeError("Invalid buyer transaction intent source plan: order ID is malformed", { cause });
  }
  const allowance = buyerPlan.prerequisites.find((prerequisite) => prerequisite.kind === "exact-usdc-allowance");
  const effect = buyerPlan.expectedUsdcEffect;
  if (
    !allowance
    || allowance.owner !== buyer
    || allowance.spender !== ARC_TESTNET.settlementEscrow.address
    || allowance.amount <= 0n
    || effect.kind !== "escrow-funded"
    || effect.from !== buyer
    || effect.to !== ARC_TESTNET.settlementEscrow.address
    || effect.amount !== allowance.amount
    || effect.mechanism !== "SettlementEscrow fundOrder transferFrom"
  ) {
    invalid("fund plan must retain the exact approval prerequisite");
  }
  const prerequisites = immutablePrerequisites(buyerPlan.prerequisites);
  const intent: BuyerTransactionIntent = {
    operation: "fund-order",
    chainId: ARC_TESTNET.chainId,
    from: buyer,
    to: ARC_TESTNET.settlementEscrow.address,
    data: encodeFunctionData({ abi: settlementEscrowAbi, functionName: "fundOrder", args: [abiBytes32(orderId)] }),
    value: 0n,
    expectedSigner: { kind: "buyer", address: buyer },
    summary: buyerPlan.summary,
    prerequisites,
  };
  return Object.freeze({ ...intent, expectedSigner: Object.freeze(intent.expectedSigner) });
}