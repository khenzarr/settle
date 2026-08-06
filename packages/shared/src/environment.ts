import { ARC_TESTNET } from "./chains.ts";
import { nonZeroEvmAddressSchema, normalizeAddress } from "./schemas.ts";
import type { EvmAddress } from "./schemas.ts";

export const ARC_TESTNET_RPC_URL_ENV = "ARC_TESTNET_RPC_URL" as const;
export const NEXT_PUBLIC_ARC_TESTNET_RPC_URL_ENV = "NEXT_PUBLIC_ARC_TESTNET_RPC_URL" as const;
export const NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS_ENV = "NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS" as const;

export type EnvironmentValues = Readonly<Record<string, string | undefined>>;

function getNonEmptyValue(values: EnvironmentValues, name: string): string | undefined {
  const value = values[name]?.trim();
  return value === "" ? undefined : value;
}

function parseHttpUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Arc Testnet RPC URL must be a valid HTTP or HTTPS URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("Arc Testnet RPC URL must use HTTP or HTTPS");
  }

  return value;
}

export function parseArcTestnetRpcUrl(values: EnvironmentValues): string {
  const override = getNonEmptyValue(values, ARC_TESTNET_RPC_URL_ENV)
    ?? getNonEmptyValue(values, NEXT_PUBLIC_ARC_TESTNET_RPC_URL_ENV);

  return override === undefined ? ARC_TESTNET.rpcUrl : parseHttpUrl(override);
}

export function parseSettlementContractAddress(values: EnvironmentValues): EvmAddress | undefined {
  const address = getNonEmptyValue(values, NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS_ENV);
  if (address === undefined) return undefined;

  nonZeroEvmAddressSchema.parse(address);
  return normalizeAddress(address);
}