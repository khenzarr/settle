import {
  ARC_TESTNET,
  MARKETPLACE_COMMAND_ABI_SIGNATURES,
  MarketplaceSignerKind,
  normalizeAddress,
  orderStatusLabel,
  type CreateOrderCommandPlan,
  type EvmAddress,
  type MarketplaceCommandPlan,
  type MarketplaceStateTransition,
  type ReleaseOrderCommandPlan,
} from "@settle/shared";

import { runPreparedWalletContractExecution } from "./wallet-contract-execution.ts";
import type { WalletContractExecutionDependencies, WalletContractExecutionPlan } from "./wallet-contract-execution.ts";
import { parseEvmAddress, parseFeeLevel, parseMutationExecutionGate, rejectLocalMutation } from "./wallet-mutations.ts";

export type OperatorSettlementCommandPlan = CreateOrderCommandPlan | ReleaseOrderCommandPlan;

export interface OperatorSettlementExecutionPreparation {
  readonly operation: OperatorSettlementCommandPlan["operation"];
  readonly operatorSigner: EvmAddress;
  readonly contractAddress: EvmAddress;
  readonly abiFunctionSignature: string;
  readonly parameterCount: number;
  readonly expectedStateTransition: MarketplaceStateTransition;
  readonly contractExecutionPlan: WalletContractExecutionPlan;
}

export interface PrepareOperatorSettlementExecutionInput {
  readonly plan: MarketplaceCommandPlan;
  readonly configuredWalletAddress: string;
  readonly configuredOperatorAddress: string;
  readonly feeLevel?: string;
  readonly execute?: boolean;
}

export interface RunOperatorSettlementExecutionInput extends PrepareOperatorSettlementExecutionInput {
  readonly configuredWalletId: string;
  readonly idempotencyKey?: string;
  readonly createExecutionDependencies?: () => WalletContractExecutionDependencies;
}

export function prepareOperatorSettlementExecution(
  input: PrepareOperatorSettlementExecutionInput,
): OperatorSettlementExecutionPreparation {
  const plan = requireOperatorSettlementPlan(input.plan);
  const operatorSigner = parseEvmAddress(plan.expectedSigner.address, "plan operator address");
  const configuredOperator = parseEvmAddress(input.configuredOperatorAddress, "configured operator address");
  const configuredWallet = parseEvmAddress(input.configuredWalletAddress, "configured Circle wallet address");

  if (configuredOperator !== operatorSigner) {
    throw new TypeError("Shared plan operator does not match configured product operator address");
  }
  if (configuredWallet !== operatorSigner) {
    throw new TypeError("Configured Circle wallet address does not match Shared plan operator");
  }

  const contractExecutionPlan: WalletContractExecutionPlan = {
    operation: "wallet contract execution",
    blockchain: "ARC-TESTNET",
    sourceAddress: configuredWallet,
    contractAddress: plan.targetAddress,
    functionSignature: plan.abiFunctionSignature,
    parameters: plan.abiParameters.map(toCircleAbiValue),
    parameterCount: plan.abiParameters.length,
    feeLevel: parseFeeLevel(input.feeLevel),
    executionRequired: input.execute === true,
  };

  return {
    operation: plan.operation,
    operatorSigner,
    contractAddress: plan.targetAddress,
    abiFunctionSignature: plan.abiFunctionSignature,
    parameterCount: plan.abiParameters.length,
    expectedStateTransition: plan.expectedStateTransition,
    contractExecutionPlan,
  };
}

export async function runOperatorSettlementExecution(
  input: RunOperatorSettlementExecutionInput,
): Promise<readonly string[]> {
  let preparation: OperatorSettlementExecutionPreparation;
  let gate: ReturnType<typeof parseMutationExecutionGate>;
  try {
    gate = parseMutationExecutionGate({ execute: input.execute, idempotencyKey: input.idempotencyKey });
    preparation = prepareOperatorSettlementExecution(input);
  } catch (error) {
    rejectLocalMutation(error);
  }

  if (!gate.execute) return formatOperatorSettlementExecutionPreparation(preparation);

  return runPreparedWalletContractExecution({
    plan: preparation.contractExecutionPlan,
    gate,
    configuredWalletId: input.configuredWalletId,
    ...(input.createExecutionDependencies === undefined ? {} : { createExecutionDependencies: input.createExecutionDependencies }),
  });
}

export function formatOperatorSettlementExecutionPreparation(
  preparation: OperatorSettlementExecutionPreparation,
): readonly string[] {
  return [
    "Circle operator settlement execution plan (dry run; no Circle mutation):",
    `operation: ${preparation.operation}`,
    `operator signer: ${preparation.operatorSigner}`,
    `contract: ${preparation.contractAddress}`,
    `ABI signature: ${preparation.abiFunctionSignature}`,
    `parameter count: ${preparation.parameterCount}`,
    `expected state transition: ${formatStateTransition(preparation.expectedStateTransition)}`,
  ];
}

function requireOperatorSettlementPlan(plan: MarketplaceCommandPlan): OperatorSettlementCommandPlan {
  if (plan.expectedSigner.kind !== MarketplaceSignerKind.Operator) {
    throw new TypeError("Operator settlement bridge requires an operator signer");
  }
  if (normalizeAddress(plan.targetAddress) !== ARC_TESTNET.settlementEscrow.address) {
    throw new TypeError("Operator settlement bridge requires the canonical SettlementEscrow target");
  }

  switch (plan.operation) {
    case "create-order":
      if (plan.abiFunctionSignature !== MARKETPLACE_COMMAND_ABI_SIGNATURES.createOrder) {
        throw new TypeError("Create-order plan ABI signature is not canonical");
      }
      return plan;
    case "release-order":
      if (plan.abiFunctionSignature !== MARKETPLACE_COMMAND_ABI_SIGNATURES.releaseOrder) {
        throw new TypeError("Release-order plan ABI signature is not canonical");
      }
      return plan;
    case "approve-usdc":
    case "fund-order":
      throw new TypeError(`Operator settlement bridge does not support ${plan.operation}`);
    default:
      throw new TypeError("Operator settlement bridge received an unsupported operation");
  }
}

function toCircleAbiValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString(10);
  if (Array.isArray(value)) return value.map(toCircleAbiValue);
  return value;
}

function formatStateTransition(transition: MarketplaceStateTransition): string {
  if (transition.system === "settlement-escrow") {
    return `${transition.system} ${orderStatusLabel(transition.from)} -> ${orderStatusLabel(transition.to)}`;
  }
  return `${transition.system} ${String(transition.from)} -> ${String(transition.to)}`;
}