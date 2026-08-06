import { USDC_DECIMALS } from "./constants.ts";
import { evmAddressSchema } from "./schemas.ts";

export const ARC_TESTNET_ENVIRONMENT = "arc-testnet" as const;

const ARC_TESTNET_USDC_ADDRESS = evmAddressSchema.parse("0x3600000000000000000000000000000000000000");

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
} as const;

export type ArcTestnetMetadata = typeof ARC_TESTNET;