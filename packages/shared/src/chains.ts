import { USDC_DECIMALS } from "./constants.ts";
import { evmAddressSchema } from "./schemas.ts";

export const ARC_TESTNET_ENVIRONMENT = "arc-testnet" as const;

const ARC_TESTNET_USDC_ADDRESS = evmAddressSchema.parse("0x3600000000000000000000000000000000000000");
const ARC_TESTNET_SETTLEMENT_ESCROW_ADDRESS = evmAddressSchema.parse("0x3e438ae878a8dc02c83f5545047cbde33a4f795f");

export const ARC_TESTNET = {
  environment: ARC_TESTNET_ENVIRONMENT,
  name: "Arc Testnet",
  chainId: 5_042_002,
  rpcUrl: "https://rpc.testnet.arc.network",
  explorerBaseUrl: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  usdc: {
    address: ARC_TESTNET_USDC_ADDRESS,
    symbol: "USDC",
    decimals: USDC_DECIMALS,
  },
  settlementEscrow: {
    address: ARC_TESTNET_SETTLEMENT_ESCROW_ADDRESS,
  },
} as const;

export type ArcTestnetMetadata = typeof ARC_TESTNET;