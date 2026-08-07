import type { CircleDeveloperControlledWalletsClient, CreateContractExecutionTransactionInput } from "@circle-fin/developer-controlled-wallets";
import type { EvmAddress } from "@settle/shared";
import { withCircleErrorNormalization } from "./errors.ts";
import { CIRCLE_ARC_TESTNET_BLOCKCHAIN, preflightDeployerWallet } from "./wallets.ts";
import type { CircleWalletRecord } from "./wallets.ts";
import { executeCircleMutationSubmission, formatFeePolicy, formatMutationSubmission, parseEvmAddress, parseFeeLevel, parseMutationExecutionGate, parseOptionalNonNegativeDecimal, readStrictOptions, rejectLocalMutation, validateSubmissionResult } from "./wallet-mutations.ts";
import type { CircleMutationFeeLevel, MutationSubmissionResult } from "./wallet-mutations.ts";

export interface WalletContractExecutionPlan {
  readonly operation: "wallet contract execution";
  readonly blockchain: typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN;
  readonly sourceAddress: EvmAddress;
  readonly contractAddress: EvmAddress;
  readonly functionSignature: string;
  readonly parameters: readonly unknown[];
  readonly parameterCount: number;
  readonly amount?: string;
  readonly feeLevel: CircleMutationFeeLevel;
  readonly executionRequired: boolean;
}

export interface WalletContractExecutionArguments {
  readonly contract: string;
  readonly functionSignature: string;
  readonly parameters: string;
  readonly amount?: string;
  readonly feeLevel?: string;
  readonly execute: boolean;
  readonly idempotencyKey?: string;
}

export interface WalletContractExecutionGateway {
  submit(input: CreateContractExecutionTransactionInput): Promise<MutationSubmissionResult>;
}

export function parseWalletContractExecutionArguments(args: readonly string[]): WalletContractExecutionArguments {
  const options = readStrictOptions(args, {
    "--contract": "value", "--function": "value", "--parameters": "value", "--amount": "value",
    "--fee-level": "value", "--execute": "boolean", "--idempotency-key": "value",
  });
  if (typeof options.contract !== "string") throw new TypeError("--contract is required");
  if (typeof options.function !== "string") throw new TypeError("--function is required");
  if (typeof options.parameters !== "string") throw new TypeError("--parameters is required");
  const gate = parseMutationExecutionGate(options);
  return {
    contract: options.contract,
    functionSignature: options.function,
    parameters: options.parameters,
    ...(typeof options.amount === "string" ? { amount: options.amount } : {}),
    ...(typeof options.feeLevel === "string" ? { feeLevel: options.feeLevel } : {}),
    ...gate,
  };
}

export function prepareWalletContractExecution(input: Readonly<{ args: WalletContractExecutionArguments; sourceAddress: string }>): WalletContractExecutionPlan {
  const functionSignature = parseFunctionSignature(input.args.functionSignature);
  const parameters = parseAbiParameters(input.args.parameters);
  const expectedCount = countFunctionParameters(functionSignature);
  if (parameters.length !== expectedCount) throw new TypeError(`--parameters must contain ${expectedCount} value(s) for ${functionSignature}`);
  const amount = parseOptionalNonNegativeDecimal(input.args.amount, "--amount");
  return {
    operation: "wallet contract execution",
    blockchain: CIRCLE_ARC_TESTNET_BLOCKCHAIN,
    sourceAddress: parseEvmAddress(input.sourceAddress, "configured wallet address"),
    contractAddress: parseEvmAddress(input.args.contract, "--contract"),
    functionSignature,
    parameters,
    parameterCount: parameters.length,
    ...(amount === undefined ? {} : { amount }),
    feeLevel: parseFeeLevel(input.args.feeLevel),
    executionRequired: input.args.execute,
  };
}

export async function runWalletContractExecutionCommand(input: Readonly<{
  args: readonly string[];
  sourceAddress: string;
  configuredWalletId: string;
  createExecutionDependencies?: () => Readonly<{
    preflightGateway: Readonly<{ getWallet(walletId: string): Promise<CircleWalletRecord> }>;
    mutationGateway: WalletContractExecutionGateway;
  }>;
}>): Promise<readonly string[]> {
  let args: WalletContractExecutionArguments;
  let plan: WalletContractExecutionPlan;
  try {
    args = parseWalletContractExecutionArguments(input.args);
    plan = prepareWalletContractExecution({ args, sourceAddress: input.sourceAddress });
  } catch (error) {
    rejectLocalMutation(error);
  }
  if (!args.execute) return formatWalletContractExecutionPlan(plan);
  if (input.createExecutionDependencies === undefined) throw new TypeError("Execution dependencies are required with --execute");
  const dependencies = input.createExecutionDependencies();
  await preflightDeployerWallet({ gateway: dependencies.preflightGateway, configuredWalletId: input.configuredWalletId, configuredAddress: plan.sourceAddress });
  const result = await executeCircleMutationSubmission(() => dependencies.mutationGateway.submit(
    createContractExecutionRequest(plan, input.configuredWalletId, args.idempotencyKey!),
  ));
  return formatMutationSubmission(result);
}

export function createCircleWalletContractExecutionGateway(client: CircleDeveloperControlledWalletsClient): WalletContractExecutionGateway {
  return {
    async submit(input) {
      return withCircleErrorNormalization("createContractExecutionTransaction", async () => {
        const response = await client.createContractExecutionTransaction(input);
        if (response.data === undefined) throw new TypeError("Circle createContractExecutionTransaction response did not contain transaction data");
        return validateSubmissionResult(response.data);
      });
    },
  };
}

export function formatWalletContractExecutionPlan(plan: WalletContractExecutionPlan): readonly string[] {
  return [
    "Circle wallet contract-execution plan (dry run; no Circle mutation):",
    `operation: ${plan.operation}`,
    `blockchain: ${plan.blockchain}`,
    `source address: ${plan.sourceAddress}`,
    `contract address: ${plan.contractAddress}`,
    `function: ${plan.functionSignature}`,
    `parameter count: ${plan.parameterCount}`,
    ...(plan.amount === undefined ? [] : [`native value: ${plan.amount}`]),
    `fee policy: ${formatFeePolicy(plan.feeLevel)}`,
    `execution required: ${plan.executionRequired ? "yes" : "no"}`,
  ];
}

function createContractExecutionRequest(plan: WalletContractExecutionPlan, walletId: string, idempotencyKey: string): CreateContractExecutionTransactionInput {
  return {
    walletId,
    contractAddress: plan.contractAddress,
    abiFunctionSignature: plan.functionSignature,
    abiParameters: [...plan.parameters],
    ...(plan.amount === undefined ? {} : { amount: plan.amount }),
    fee: { type: "level", config: { feeLevel: plan.feeLevel } },
    idempotencyKey,
  };
}

function parseFunctionSignature(value: string): string {
  const signature = value.trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*\((?:[A-Za-z0-9_$\[\],()]*)\)$/.test(signature) || /\s/.test(signature)) {
    throw new TypeError("--function must be a canonical ABI function signature such as transfer(address,uint256)");
  }
  return signature;
}

function parseAbiParameters(value: string): readonly unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("--parameters must be a valid JSON array");
  }
  if (!Array.isArray(parsed)) throw new TypeError("--parameters must be a JSON array");
  if (parsed.length > 100) throw new TypeError("--parameters contains too many values");
  if (!isSupportedAbiValue(parsed)) throw new TypeError("--parameters may contain only strings, finite numbers, booleans, and arrays of those values");
  return parsed;
}

function isSupportedAbiValue(value: unknown): boolean {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && Number.isSafeInteger(value);
  return Array.isArray(value) && value.every(isSupportedAbiValue);
}

function countFunctionParameters(signature: string): number {
  const body = signature.slice(signature.indexOf("(") + 1, -1);
  if (body === "") return 0;
  let depth = 0;
  let count = 1;
  for (const character of body) {
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) count += 1;
  }
  if (depth !== 0) throw new TypeError("--function contains unbalanced tuple parentheses");
  return count;
}