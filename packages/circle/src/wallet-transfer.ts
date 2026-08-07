import type { CircleDeveloperControlledWalletsClient, CreateTransferTransactionInput } from "@circle-fin/developer-controlled-wallets";
import type { EvmAddress } from "@settle/shared";
import { withCircleErrorNormalization } from "./errors.ts";
import { CIRCLE_ARC_TESTNET_BLOCKCHAIN, preflightDeployerWallet } from "./wallets.ts";
import type { CircleWalletRecord } from "./wallets.ts";
import { executeCircleMutationSubmission, formatFeePolicy, formatMutationSubmission, parseEvmAddress, parseFeeLevel, parseMutationExecutionGate, parsePositiveDecimal, readStrictOptions, rejectLocalMutation, validateSubmissionResult } from "./wallet-mutations.ts";
import type { CircleMutationFeeLevel, MutationSubmissionResult } from "./wallet-mutations.ts";

export type TransferTokenReference = Readonly<
  { kind: "token-id"; tokenId: string }
  | { kind: "token-address"; tokenAddress: EvmAddress }
>;

export interface WalletTransferPlan {
  readonly operation: "wallet transfer";
  readonly blockchain: typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN;
  readonly sourceAddress: EvmAddress;
  readonly destination: EvmAddress;
  readonly token: TransferTokenReference;
  readonly amount: string;
  readonly feeLevel: CircleMutationFeeLevel;
  readonly executionRequired: boolean;
}

export interface WalletTransferArguments {
  readonly destination: string;
  readonly amount: string;
  readonly tokenId?: string;
  readonly tokenAddress?: string;
  readonly feeLevel?: string;
  readonly execute: boolean;
  readonly idempotencyKey?: string;
}

export interface WalletTransferGateway {
  submit(input: CreateTransferTransactionInput): Promise<MutationSubmissionResult>;
}

export function parseWalletTransferArguments(args: readonly string[]): WalletTransferArguments {
  const options = readStrictOptions(args, {
    "--destination": "value", "--amount": "value", "--token-id": "value", "--token-address": "value",
    "--fee-level": "value", "--execute": "boolean", "--idempotency-key": "value",
  });
  if (typeof options.destination !== "string") throw new TypeError("--destination is required");
  if (typeof options.amount !== "string") throw new TypeError("--amount is required");
  if ((options.tokenId === undefined) === (options.tokenAddress === undefined)) {
    throw new TypeError("Provide exactly one of --token-id or --token-address");
  }
  const gate = parseMutationExecutionGate(options);
  return {
    destination: options.destination,
    amount: options.amount,
    ...(typeof options.tokenId === "string" ? { tokenId: options.tokenId } : {}),
    ...(typeof options.tokenAddress === "string" ? { tokenAddress: options.tokenAddress } : {}),
    ...(typeof options.feeLevel === "string" ? { feeLevel: options.feeLevel } : {}),
    ...gate,
  };
}

export function prepareWalletTransfer(input: Readonly<{ args: WalletTransferArguments; sourceAddress: string }>): WalletTransferPlan {
  const destination = parseEvmAddress(input.args.destination, "--destination");
  const amount = parsePositiveDecimal(input.args.amount, "--amount");
  const token = input.args.tokenId !== undefined
    ? parseTokenId(input.args.tokenId)
    : { kind: "token-address" as const, tokenAddress: parseEvmAddress(input.args.tokenAddress!, "--token-address") };
  return {
    operation: "wallet transfer",
    blockchain: CIRCLE_ARC_TESTNET_BLOCKCHAIN,
    sourceAddress: parseEvmAddress(input.sourceAddress, "configured wallet address"),
    destination,
    token,
    amount,
    feeLevel: parseFeeLevel(input.args.feeLevel),
    executionRequired: input.args.execute,
  };
}

export async function runWalletTransferCommand(input: Readonly<{
  args: readonly string[];
  sourceAddress: string;
  configuredWalletId: string;
  createExecutionDependencies?: () => Readonly<{
    preflightGateway: Readonly<{ getWallet(walletId: string): Promise<CircleWalletRecord> }>;
    mutationGateway: WalletTransferGateway;
  }>;
}>): Promise<readonly string[]> {
  let args: WalletTransferArguments;
  let plan: WalletTransferPlan;
  try {
    args = parseWalletTransferArguments(input.args);
    plan = prepareWalletTransfer({ args, sourceAddress: input.sourceAddress });
  } catch (error) {
    rejectLocalMutation(error);
  }
  if (!args.execute) return formatWalletTransferPlan(plan);
  if (input.createExecutionDependencies === undefined) throw new TypeError("Execution dependencies are required with --execute");

  const dependencies = input.createExecutionDependencies();
  await preflightDeployerWallet({ gateway: dependencies.preflightGateway, configuredWalletId: input.configuredWalletId, configuredAddress: plan.sourceAddress });
  const result = await executeCircleMutationSubmission(() => dependencies.mutationGateway.submit(
    createTransferRequest(plan, input.configuredWalletId, args.idempotencyKey!),
  ));
  return formatMutationSubmission(result);
}

export function createCircleWalletTransferGateway(client: CircleDeveloperControlledWalletsClient): WalletTransferGateway {
  return {
    async submit(input) {
      return withCircleErrorNormalization("createTransaction", async () => {
        const response = await client.createTransaction(input);
        if (response.data === undefined) throw new TypeError("Circle createTransaction response did not contain transaction data");
        return validateSubmissionResult(response.data);
      });
    },
  };
}

export function formatWalletTransferPlan(plan: WalletTransferPlan): readonly string[] {
  return [
    "Circle wallet transfer plan (dry run; no Circle mutation):",
    `operation: ${plan.operation}`,
    `blockchain: ${plan.blockchain}`,
    `source address: ${plan.sourceAddress}`,
    `destination: ${plan.destination}`,
    `token reference: ${plan.token.kind === "token-id" ? `Circle token ID ${plan.token.tokenId}` : `token address ${plan.token.tokenAddress}`}`,
    `amount: ${plan.amount}`,
    `fee policy: ${formatFeePolicy(plan.feeLevel)}`,
    `execution required: ${plan.executionRequired ? "yes" : "no"}`,
  ];
}

function createTransferRequest(plan: WalletTransferPlan, walletId: string, idempotencyKey: string): CreateTransferTransactionInput {
  const common = {
    walletId,
    amount: [plan.amount],
    destinationAddress: plan.destination,
    fee: { type: "level" as const, config: { feeLevel: plan.feeLevel } },
    idempotencyKey,
  };
  return plan.token.kind === "token-id"
    ? { ...common, tokenId: plan.token.tokenId }
    : { ...common, tokenAddress: plan.token.tokenAddress };
}

function parseTokenId(value: string): TransferTokenReference {
  const tokenId = value.trim();
  if (tokenId.length === 0 || tokenId.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(tokenId)) throw new TypeError("--token-id is malformed");
  return { kind: "token-id", tokenId };
}