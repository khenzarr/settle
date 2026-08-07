import type { CircleDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { CircleSmartContractPlatformClient } from "@circle-fin/smart-contract-platform";
import { z } from "zod";
import type { CanonicalCircleDeploymentRequest, CircleContractDeploymentPreparation } from "./contracts.ts";
import { createCanonicalDeploymentRequest, createPublicationSafeDeploymentSummary } from "./contracts.ts";
import type { PublicationSafeWalletMetadata } from "./wallets.ts";
import { redactString } from "./redaction.ts";
import { withCircleErrorNormalization } from "./errors.ts";

const uuidSchema = z.string().uuid();

export interface SafeFeeEstimate {
  readonly blockchain: "ARC-TESTNET";
  readonly sourceWalletAddress: string;
  readonly feeLevel: "MEDIUM";
  readonly gasLimit?: string;
  readonly baseFee?: string;
  readonly priorityFee?: string;
  readonly maxFee?: string;
  readonly gasPrice?: string;
  readonly networkFee?: string;
  readonly networkFeeRaw?: string;
  readonly l1Fee?: string;
  readonly requestId?: string;
}

export interface DeploymentSubmissionResult {
  readonly contractId: string;
  readonly transactionId: string;
}

export interface DeploymentCommandArguments {
  readonly execute: boolean;
  readonly idempotencyKey?: string;
}

export function parseDeploymentCommandArguments(values: readonly string[]): DeploymentCommandArguments {
  let execute = false;
  let idempotencyKey: string | undefined;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--execute") {
      if (execute) throw new TypeError("--execute may only be provided once");
      execute = true;
    } else if (value === "--idempotency-key") {
      if (idempotencyKey !== undefined) throw new TypeError("--idempotency-key may only be provided once");
      const next = values[++index];
      if (next === undefined || next.startsWith("--")) throw new TypeError("--idempotency-key requires a value");
      idempotencyKey = next;
    } else {
      throw new TypeError(`Unsupported argument: ${value}`);
    }
  }
  if (!execute && idempotencyKey !== undefined) throw new TypeError("--execute is required before a deployment can be submitted");
  if (execute && idempotencyKey === undefined) throw new TypeError("--idempotency-key is required with --execute");
  return { execute, ...(idempotencyKey === undefined ? {} : { idempotencyKey: parseUuidV4(idempotencyKey) }) };
}

export async function runDeploymentCommand(input: Readonly<{
  args: readonly string[];
  preparation: CircleContractDeploymentPreparation;
  preflight: () => Promise<PublicationSafeWalletMetadata>;
  submit: (request: CanonicalCircleDeploymentRequest, idempotencyKey: string) => Promise<DeploymentSubmissionResult>;
}>): Promise<readonly string[]> {
  const parsed = parseDeploymentCommandArguments(input.args);
  const summary = createPublicationSafeDeploymentSummary(input.preparation);
  if (!parsed.execute) return formatDeploymentPlan(summary);

  await input.preflight();
  const result = await input.submit(createCanonicalDeploymentRequest(input.preparation), parsed.idempotencyKey!);
  return formatDeploymentSubmission(result, summary);
}

export function formatDeploymentPlan(summary: ReturnType<typeof createPublicationSafeDeploymentSummary>): readonly string[] {
  return [
    "Circle contract deployment plan (dry run; no Circle mutation):",
    "operation: deploy SettlementEscrow",
    `blockchain: ${summary.blockchain}`,
    `wallet ID: ${summary.deployerWalletId}`,
    `wallet address: ${summary.deployerAddress}`,
    `ABI entry count: ${summary.abiEntryCount}`,
    `bytecode length: ${summary.bytecodeLength} bytes`,
    `official USDC: ${summary.officialUsdcAddress}`,
    ...Object.entries(summary.constructorRoles).map(([role, address]) => `${role}: ${address}`),
    "fee level: MEDIUM",
    "required execution arguments: --execute --idempotency-key <caller-generated UUIDv4>",
  ];
}

export function formatDeploymentSubmission(
  result: DeploymentSubmissionResult,
  summary: ReturnType<typeof createPublicationSafeDeploymentSummary>,
): readonly string[] {
  return [
    `contract ID: ${result.contractId}`,
    `transaction ID: ${result.transactionId}`,
    `blockchain: ${summary.blockchain}`,
    `wallet ID: ${summary.deployerWalletId}`,
    `wallet address: ${summary.deployerAddress}`,
    "deployment state: initiated",
    "Update CIRCLE_SETTLEMENT_CONTRACT_ID and CIRCLE_DEPLOYMENT_TRANSACTION_ID in your secret-managed local environment.",
  ];
}

export function formatSafeFeeEstimate(estimate: SafeFeeEstimate): readonly string[] {
  return ["Circle SettlementEscrow deployment estimate:", ...Object.entries(estimate).map(([key, value]) => `${key}: ${redactString(String(value))}`)];
}

export async function estimateDeployment(input: Readonly<{
  client: CircleSmartContractPlatformClient;
  preparation: CircleContractDeploymentPreparation;
}>): Promise<SafeFeeEstimate> {
  return withCircleErrorNormalization("estimateContractDeploymentFee", async () => {
    const response = await input.client.estimateContractDeploymentFee({
      walletId: input.preparation.deployerWalletId,
      bytecode: input.preparation.bytecode,
      constructorSignature: input.preparation.constructorSignature,
      constructorParameters: [...input.preparation.constructorParameters],
    });
    const fee = isRecord(response.data?.medium) ? response.data.medium : undefined;
    return {
      blockchain: input.preparation.blockchain,
      sourceWalletAddress: input.preparation.deployerAddress,
      feeLevel: "MEDIUM",
      ...safeFeeField(fee, "gasLimit"),
      ...safeFeeField(fee, "baseFee"),
      ...safeFeeField(fee, "priorityFee"),
      ...safeFeeField(fee, "maxFee"),
      ...safeFeeField(fee, "gasPrice"),
      ...safeFeeField(fee, "networkFee"),
      ...safeFeeField(fee, "networkFeeRaw"),
      ...safeFeeField(fee, "l1Fee"),
      ...safeRequestId(response),
    };
  });
}

export async function submitDeployment(input: Readonly<{
  client: CircleSmartContractPlatformClient;
  request: CanonicalCircleDeploymentRequest;
  idempotencyKey: string;
}>): Promise<DeploymentSubmissionResult> {
  return withCircleErrorNormalization("deployContract", async () => {
    const deployRequest = {
      idempotencyKey: input.idempotencyKey,
      name: input.request.name,
      description: input.request.description,
      walletId: input.request.walletId,
      abiJson: input.request.abiJson,
      bytecode: input.request.bytecode,
      constructorParameters: [...input.request.constructorParameters],
      fee: input.request.fee,
    };
    // SDK 10.8 types still require blockchain in wallet-ID mode, contrary to the endpoint request model.
    const response = await input.client.deployContract(
      deployRequest as unknown as Parameters<CircleSmartContractPlatformClient["deployContract"]>[0],
    );
    return {
      contractId: uuidSchema.parse(response.data?.contractId),
      transactionId: uuidSchema.parse(response.data?.transactionId),
    };
  });
}

export interface SafeContractStatus {
  readonly contractId: string;
  readonly blockchain: string;
  readonly status: string;
  readonly contractAddress?: string;
  readonly verificationStatus?: string;
  readonly failureReason?: string;
  readonly transactionId?: string;
  readonly transactionHash?: string;
  readonly requestId?: string;
}

export interface SafeTransactionStatus {
  readonly transactionId: string;
  readonly blockchain: string;
  readonly state: string;
  readonly transactionHash?: string;
  readonly blockHeight?: number;
  readonly networkFee?: string;
  readonly failureReason?: string;
  readonly requestId?: string;
}

export async function getContractStatus(client: CircleSmartContractPlatformClient, id: string): Promise<SafeContractStatus> {
  return withCircleErrorNormalization("getContract", async () => {
    const response = await client.getContract({ id });
    const contract = response.data?.contract;
    if (contract === undefined) throw new TypeError("Circle getContract response did not contain a contract");
    return {
      contractId: contract.id,
      blockchain: contract.blockchain,
      status: contract.status,
      ...(contract.contractAddress === undefined ? {} : { contractAddress: contract.contractAddress }),
      ...(contract.verificationStatus === undefined ? {} : { verificationStatus: contract.verificationStatus }),
      ...(contract.deploymentErrorReason === undefined ? {} : { failureReason: contract.deploymentErrorReason }),
      ...(contract.deploymentTransactionId === undefined ? {} : { transactionId: contract.deploymentTransactionId }),
      ...(contract.txHash === undefined ? {} : { transactionHash: contract.txHash }),
      ...safeRequestId(response),
    };
  });
}

export async function getTransactionStatus(client: CircleDeveloperControlledWalletsClient, id: string): Promise<SafeTransactionStatus> {
  return withCircleErrorNormalization("getTransaction", async () => {
    const response = await client.getTransaction({ id });
    const transaction = response.data?.transaction;
    if (transaction === undefined) throw new TypeError("Circle getTransaction response did not contain a transaction");
    return {
      transactionId: transaction.id,
      blockchain: transaction.blockchain,
      state: transaction.state,
      ...(transaction.txHash === undefined ? {} : { transactionHash: transaction.txHash }),
      ...(transaction.blockHeight === undefined ? {} : { blockHeight: transaction.blockHeight }),
      ...(transaction.networkFee === undefined ? {} : { networkFee: transaction.networkFee }),
      ...(transaction.errorReason === undefined ? {} : { failureReason: transaction.errorReason }),
      ...safeRequestId(response),
    };
  });
}

function safeRequestId(response: unknown): Readonly<{ requestId?: string }> {
  const headers = isRecord(response) && isRecord(response.headers) ? response.headers : undefined;
  const value = headers?.["x-request-id"] ?? headers?.["X-Request-Id"];
  return typeof value === "string" && /^[A-Za-z0-9._:/-]{1,200}$/.test(value) ? { requestId: value } : {};
}

function parseUuidV4(value: string): string {
  const parsed = uuidSchema.parse(value);
  if (parsed[14]?.toLowerCase() !== "4") throw new TypeError("--idempotency-key must be a UUIDv4");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function safeFeeField<K extends keyof SafeFeeEstimate>(
  fee: Record<string, unknown> | undefined,
  key: K,
): Readonly<Partial<Pick<SafeFeeEstimate, K>>> {
  const value = fee?.[key];
  return typeof value === "string" && value.length <= 200
    ? { [key]: value } as Partial<Pick<SafeFeeEstimate, K>>
    : {} as Partial<Pick<SafeFeeEstimate, K>>;
}