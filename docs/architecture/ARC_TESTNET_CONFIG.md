# Arc Testnet Configuration

Settle centralizes its currently supported Arc network metadata in `packages/shared/src/chains.ts`.

## Verified testnet values

- Network: Arc Testnet
- Chain ID: `5042002`
- Official public RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Native currency: USDC with 18 decimals
- USDC ERC-20 address: `0x3600000000000000000000000000000000000000`
- USDC ERC-20 interface: 6 decimals

Arc Testnet exposes USDC as its native currency using 18-decimal native-unit behavior while also providing the official ERC-20 USDC interface with 6 decimals. These precisions are intentionally represented as separate metadata fields. Settle application accounting uses only the 6-decimal ERC-20 interface so that monetary parsing, storage, settlement amounts, and contract interactions share one exact precision model.

## Environment overrides

The shared package exposes pure parsing helpers and does not read `process.env` directly. Callers may provide `ARC_TESTNET_RPC_URL` or `NEXT_PUBLIC_ARC_TESTNET_RPC_URL`; the server-only override takes precedence when both are present. Empty values are treated as absent, and the official public RPC is the fallback. Overrides must be valid HTTP or HTTPS URLs.

`NEXT_PUBLIC_SETTLEMENT_CONTRACT_ADDRESS` is optional before deployment. When supplied, it must be a valid non-zero EVM address. No Circle credential, signing secret, or other private value belongs in a `NEXT_PUBLIC_` variable.

## Mainnet boundary

Arc mainnet is not supported. No mainnet RPC URL or contract address is configured until the official values required by Settle are published and separately verified.

All network values in this document and the shared configuration must be reverified against official sources before deployment. This configuration does not claim that Settle has been deployed.