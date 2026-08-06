import { ARC_TESTNET } from "./chains.ts";
import { evmAddressSchema, transactionHashSchema } from "./schemas.ts";

function buildExplorerUrl(segment: "address" | "block" | "token" | "tx", value: string): string {
  return `${ARC_TESTNET.explorerBaseUrl.replace(/\/+$/, "")}/${segment}/${value}`;
}

export function getExplorerTransactionUrl(transactionHash: string): string {
  return buildExplorerUrl("tx", transactionHashSchema.parse(transactionHash));
}

export function getExplorerAddressUrl(address: string): string {
  return buildExplorerUrl("address", evmAddressSchema.parse(address));
}

export function getExplorerBlockUrl(blockNumber: bigint): string {
  if (blockNumber < 0n) throw new RangeError("Block number cannot be negative");
  return buildExplorerUrl("block", blockNumber.toString());
}

export function getExplorerTokenUrl(tokenAddress: string): string {
  return buildExplorerUrl("token", evmAddressSchema.parse(tokenAddress));
}