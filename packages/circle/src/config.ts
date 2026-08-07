import { nonZeroEvmAddressSchema, normalizeAddress } from "@settle/shared";
import type { EvmAddress } from "@settle/shared";
import { z } from "zod";

export const CIRCLE_ENV_NAMES = [
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "CIRCLE_WALLET_SET_ID",
  "CIRCLE_DEPLOYER_WALLET_ID",
  "CIRCLE_DEPLOYER_ADDRESS",
] as const;

export const CIRCLE_CREDENTIAL_ENV_NAMES = ["CIRCLE_API_KEY", "CIRCLE_ENTITY_SECRET"] as const;
export const CIRCLE_ROLE_ENV_NAMES = [
  "SETTLE_ADMIN_ADDRESS",
  "SETTLE_OPERATOR_ADDRESS",
  "SETTLE_ARBITRATOR_ADDRESS",
  "SETTLE_PAUSER_ADDRESS",
] as const;

export type CircleEnvironmentName = (typeof CIRCLE_ENV_NAMES)[number];
export type EnvironmentValues = Readonly<Record<string, string | undefined>>;

export interface CircleClientConfig {
  readonly apiKey: string;
  readonly entitySecret: string;
}

export interface CircleWalletReferences {
  readonly walletSetId?: string;
  readonly deployerWalletId?: string;
}

export interface CircleDeploymentConfig {
  readonly deployerWalletId: string;
  readonly deployerAddress: EvmAddress;
  readonly administratorAddress: EvmAddress;
  readonly operatorAddress: EvmAddress;
  readonly arbitratorAddress: EvmAddress;
  readonly pauserAddress: EvmAddress;
}

export interface CircleDeploymentReferences {
  readonly contractId?: string;
  readonly transactionId?: string;
  readonly settlementContractAddress?: EvmAddress;
}

export class CircleConfigError extends Error {
  readonly missingFields: readonly string[];

  constructor(message: string, missingFields: readonly string[] = []) {
    super(message);
    this.name = "CircleConfigError";
    this.missingFields = missingFields;
  }
}

const nonEmptyStringSchema = z.string().trim().min(1);
const uuidSchema = z.string().uuid();

export function readNonEmptyEnvironmentValue(values: EnvironmentValues, name: string): string | undefined {
  const value = values[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
}

export function getCircleConfigPresence(values: EnvironmentValues): Readonly<Record<CircleEnvironmentName, boolean>> {
  return Object.fromEntries(
    CIRCLE_ENV_NAMES.map((name) => [name, readNonEmptyEnvironmentValue(values, name) !== undefined]),
  ) as Readonly<Record<CircleEnvironmentName, boolean>>;
}

export function findPublicCircleCredentialNames(values: EnvironmentValues): readonly string[] {
  return Object.keys(values)
    .filter((name) => name.startsWith("NEXT_PUBLIC_") && /CIRCLE_(?:API_KEY|ENTITY_SECRET)/i.test(name))
    .sort();
}

export function parseCircleClientConfig(values: EnvironmentValues): CircleClientConfig {
  const apiKey = readNonEmptyEnvironmentValue(values, "CIRCLE_API_KEY");
  const entitySecret = readNonEmptyEnvironmentValue(values, "CIRCLE_ENTITY_SECRET");
  const missingFields = [
    ...(apiKey === undefined ? ["CIRCLE_API_KEY"] : []),
    ...(entitySecret === undefined ? ["CIRCLE_ENTITY_SECRET"] : []),
  ];

  if (missingFields.length > 0) {
    throw new CircleConfigError(`Missing required Circle credentials: ${missingFields.join(", ")}`, missingFields);
  }

  return {
    apiKey: nonEmptyStringSchema.parse(apiKey),
    entitySecret: nonEmptyStringSchema.parse(entitySecret),
  };
}

export function parseCircleWalletReferences(values: EnvironmentValues): CircleWalletReferences {
  const walletSetId = readNonEmptyEnvironmentValue(values, "CIRCLE_WALLET_SET_ID");
  const deployerWalletId = readNonEmptyEnvironmentValue(values, "CIRCLE_DEPLOYER_WALLET_ID");
  return {
    ...(walletSetId === undefined ? {} : { walletSetId }),
    ...(deployerWalletId === undefined ? {} : { deployerWalletId }),
  };
}

export function parseCircleDeploymentConfig(values: EnvironmentValues): CircleDeploymentConfig {
  const requiredNames = [
    "CIRCLE_DEPLOYER_WALLET_ID",
    "CIRCLE_DEPLOYER_ADDRESS",
    ...CIRCLE_ROLE_ENV_NAMES,
  ] as const;
  const parsed = Object.fromEntries(
    requiredNames.map((name) => [name, readNonEmptyEnvironmentValue(values, name)]),
  ) as Record<(typeof requiredNames)[number], string | undefined>;
  const missingFields = requiredNames.filter((name) => parsed[name] === undefined);

  if (missingFields.length > 0) {
    throw new CircleConfigError(`Missing required contract preparation fields: ${missingFields.join(", ")}`, missingFields);
  }

  return {
    deployerWalletId: nonEmptyStringSchema.parse(parsed.CIRCLE_DEPLOYER_WALLET_ID),
    deployerAddress: parseAddress(parsed.CIRCLE_DEPLOYER_ADDRESS),
    administratorAddress: parseAddress(parsed.SETTLE_ADMIN_ADDRESS),
    operatorAddress: parseAddress(parsed.SETTLE_OPERATOR_ADDRESS),
    arbitratorAddress: parseAddress(parsed.SETTLE_ARBITRATOR_ADDRESS),
    pauserAddress: parseAddress(parsed.SETTLE_PAUSER_ADDRESS),
  };
}

export function parseCircleDeploymentReferences(values: EnvironmentValues): CircleDeploymentReferences {
  const contractId = readNonEmptyEnvironmentValue(values, "CIRCLE_SETTLEMENT_CONTRACT_ID");
  const transactionId = readNonEmptyEnvironmentValue(values, "CIRCLE_DEPLOYMENT_TRANSACTION_ID");
  const settlementContractAddress = readNonEmptyEnvironmentValue(values, "SETTLEMENT_CONTRACT_ADDRESS");
  return {
    ...(contractId === undefined ? {} : { contractId: uuidSchema.parse(contractId) }),
    ...(transactionId === undefined ? {} : { transactionId: uuidSchema.parse(transactionId) }),
    ...(settlementContractAddress === undefined ? {} : { settlementContractAddress: parseAddress(settlementContractAddress) }),
  };
}

export function parseUuidV4(value: string, label: string): string {
  const parsed = uuidSchema.parse(value);
  if (parsed[14]?.toLowerCase() !== "4") throw new TypeError(`${label} must be a UUIDv4`);
  return parsed;
}

function parseAddress(value: string | undefined): EvmAddress {
  const address = nonZeroEvmAddressSchema.parse(value);
  return normalizeAddress(address);
}