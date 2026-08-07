import { getExplorerTransactionUrl, nonZeroEvmAddressSchema, normalizeAddress, transactionHashSchema } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import { z } from "zod";
import { parseUuidV4 } from "./config.ts";
import { CircleIntegrationError } from "./errors.ts";
import { CIRCLE_ARC_TESTNET_BLOCKCHAIN } from "./wallets.ts";

export const CIRCLE_MUTATION_FEE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type CircleMutationFeeLevel = (typeof CIRCLE_MUTATION_FEE_LEVELS)[number];

export interface MutationExecutionGate {
  readonly execute: boolean;
  readonly idempotencyKey?: string;
}

export interface MutationSubmissionResult {
  readonly transactionId: string;
  readonly state: string;
  readonly transactionHash?: `0x${string}`;
  readonly arcScanUrl?: string;
}

export type CircleMutationOutcome = "rejected" | "submitted" | "ambiguous" | "recovery-required";

export class CircleMutationRejectedError extends Error {
  readonly outcome = "rejected" as const;
  readonly cause: unknown;
  readonly source: "local" | "circle";

  constructor(source: "local" | "circle", cause: unknown) {
    const safeDiagnostic = safeMutationDiagnostic(cause, source === "local");
    const guidance = source === "local"
      ? " No Circle mutation API call was made."
      : " Circle explicitly rejected the request; no automatic retry was attempted and no replacement idempotency key should be created.";
    super(`Circle mutation outcome: rejected (${source}).${safeDiagnostic}${guidance}`);
    this.name = "CircleMutationRejectedError";
    this.cause = cause;
    this.source = source;
  }
}

export class CircleMutationAmbiguousError extends Error {
  readonly outcome = "ambiguous" as const;
  readonly cause: unknown;

  constructor(cause: unknown) {
    const safeDiagnostic = safeMutationDiagnostic(cause);
    super(`Circle mutation outcome: ambiguous.${safeDiagnostic} Preserve the SAME idempotency key. Do not create a replacement key and do not retry blindly; diagnose whether the existing request produced a transaction first.`);
    this.name = "CircleMutationAmbiguousError";
    this.cause = cause;
  }
}

export class CircleMutationRecoveryRequiredError extends Error {
  readonly outcome = "recovery-required" as const;
  readonly cause: unknown;

  constructor(cause: unknown) {
    const safeDiagnostic = safeMutationDiagnostic(cause);
    super(`Circle mutation outcome: recovery-required.${safeDiagnostic} Preserve the SAME idempotency key and investigate the existing transaction or prior request before any further submission; do not create a replacement key.`);
    this.name = "CircleMutationRecoveryRequiredError";
    this.cause = cause;
  }
}

const decimalSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "must be a plain non-negative decimal without signs or exponent notation");
const uuidSchema = z.string().uuid();

export function parseMutationExecutionGate(values: Readonly<Record<string, string | boolean | undefined>>): MutationExecutionGate {
  const execute = values.execute === true;
  const key = typeof values.idempotencyKey === "string" ? values.idempotencyKey : undefined;
  if (execute && key === undefined) throw new TypeError("--idempotency-key is required with --execute");
  if (!execute && key !== undefined) throw new TypeError("--execute is required when --idempotency-key is provided");
  return { execute, ...(key === undefined ? {} : { idempotencyKey: parseUuidV4(key, "--idempotency-key") }) };
}

export function parsePositiveDecimal(value: string, label: string): string {
  const parsed = decimalSchema.parse(value);
  if (/^0(?:\.0+)?$/.test(parsed)) throw new TypeError(`${label} must be greater than zero`);
  return parsed;
}

export function parseOptionalNonNegativeDecimal(value: string | undefined, label: string): string | undefined {
  return value === undefined ? undefined : decimalSchema.parse(value);
}

export function parseEvmAddress(value: string, label: string): EvmAddress {
  try {
    return normalizeAddress(nonZeroEvmAddressSchema.parse(value));
  } catch {
    throw new TypeError(`${label} must be a valid non-zero 20-byte EVM address`);
  }
}

export function parseFeeLevel(value: string | undefined): CircleMutationFeeLevel {
  const normalized = value?.toUpperCase() ?? "MEDIUM";
  if (!CIRCLE_MUTATION_FEE_LEVELS.includes(normalized as CircleMutationFeeLevel)) {
    throw new TypeError("--fee-level must be LOW, MEDIUM, or HIGH");
  }
  return normalized as CircleMutationFeeLevel;
}

export function validateSubmissionResult(value: Readonly<{ id?: string; state?: string; txHash?: string }>): MutationSubmissionResult {
  const transactionId = uuidSchema.parse(value.id);
  if (typeof value.state !== "string" || value.state.length === 0) throw new TypeError("Circle mutation response did not contain a transaction state");
  const transactionHash = value.txHash === undefined ? undefined : transactionHashSchema.parse(value.txHash) as `0x${string}`;
  return {
    transactionId,
    state: value.state,
    ...(transactionHash === undefined ? {} : { transactionHash, arcScanUrl: getExplorerTransactionUrl(transactionHash) }),
  };
}

export function formatMutationSubmission(result: MutationSubmissionResult): readonly string[] {
  return [
    "mutation outcome: submitted",
    `transaction ID: ${result.transactionId}`,
    `transaction state: ${result.state}`,
    ...(result.transactionHash === undefined ? [] : [`transaction hash: ${result.transactionHash}`]),
    ...(result.arcScanUrl === undefined ? [] : [`ArcScan transaction URL: ${result.arcScanUrl}`]),
    "Submission acceptance is not transaction finality. Track the returned transaction ID with the existing read-only transaction tooling before treating the operation as complete.",
  ];
}

export async function executeCircleMutationSubmission(action: () => Promise<MutationSubmissionResult>): Promise<MutationSubmissionResult> {
  try {
    return await action();
  } catch (error) {
    if (isRecoveryRequired(error)) throw new CircleMutationRecoveryRequiredError(error);
    if (isExplicitCircleRejection(error)) throw new CircleMutationRejectedError("circle", error);
    throw new CircleMutationAmbiguousError(error);
  }
}

export function rejectLocalMutation(cause: unknown): never {
  throw new CircleMutationRejectedError("local", cause);
}

export function formatFeePolicy(feeLevel: CircleMutationFeeLevel): string {
  return `dynamic fee level ${feeLevel}`;
}

export function assertArcTestnetBlockchain(blockchain: string): asserts blockchain is typeof CIRCLE_ARC_TESTNET_BLOCKCHAIN {
  if (blockchain !== CIRCLE_ARC_TESTNET_BLOCKCHAIN) throw new TypeError(`Expected blockchain ${CIRCLE_ARC_TESTNET_BLOCKCHAIN}`);
}

export function readStrictOptions(
  args: readonly string[],
  specification: Readonly<Record<string, "boolean" | "value">>,
): Readonly<Record<string, string | boolean>> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === undefined || !flag.startsWith("--")) throw new TypeError(`Unsupported argument: ${flag ?? ""}`);
    const kind = specification[flag];
    if (kind === undefined) throw new TypeError(`Unsupported argument: ${flag}`);
    const key = toCamelCase(flag.slice(2));
    if (Object.hasOwn(result, key)) throw new TypeError(`${flag} may only be provided once`);
    if (kind === "boolean") {
      result[key] = true;
      continue;
    }
    const value = args[++index];
    if (value === undefined || value.startsWith("--")) throw new TypeError(`${flag} requires a value`);
    result[key] = value;
  }
  return result;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isRecoveryRequired(error: unknown): boolean {
  if (!(error instanceof CircleIntegrationError)) return false;
  if (error.status === 409) return true;
  const diagnostic = [
    error.code,
    error.circleMessage,
    ...error.validationDetails.flatMap((detail) => [detail.field, detail.message]),
  ].filter((value): value is string => value !== undefined).join(" ");
  return /(?:idempoten\w*|prior request|previous request)/i.test(diagnostic)
    && /(?:conflict|duplicate|already|prior|previous|exist|reus|same|used)/i.test(diagnostic);
}

function isExplicitCircleRejection(error: unknown): boolean {
  return error instanceof CircleIntegrationError
    && error.status !== undefined
    && error.status >= 400
    && error.status < 500
    && ![408, 409].includes(error.status);
}

function safeMutationDiagnostic(cause: unknown, includeLocalTypeError = false): string {
  if (cause instanceof CircleIntegrationError) return ` ${cause.message}`;
  if (includeLocalTypeError && cause instanceof TypeError) return ` ${cause.message}`;
  return "";
}