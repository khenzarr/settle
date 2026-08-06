import { z } from "zod";

export const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;
export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as const;

export const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Expected a 20-byte hexadecimal EVM address");
export const nonZeroEvmAddressSchema = evmAddressSchema.refine((value) => value.toLowerCase() !== ZERO_ADDRESS, "Address cannot be zero");
export const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected a 32-byte hexadecimal value");
export const orderIdSchema = bytes32Schema.refine((value) => value.toLowerCase() !== ZERO_BYTES32, "Order ID cannot be zero");
export const termsHashSchema = bytes32Schema.refine((value) => value.toLowerCase() !== ZERO_BYTES32, "Terms hash cannot be zero");
export const transactionHashSchema = bytes32Schema;

export type EvmAddress = z.infer<typeof evmAddressSchema>;
export type Bytes32 = z.infer<typeof bytes32Schema>;
export type OrderId = z.infer<typeof orderIdSchema>;
export type TermsHash = z.infer<typeof termsHashSchema>;
export type TransactionHash = z.infer<typeof transactionHashSchema>;

export function normalizeAddress(address: string): EvmAddress {
  return evmAddressSchema.parse(address).toLowerCase();
}