# Circle Contract Deployment

## Current status

The production-safe Circle deployment pipeline is implemented. Earlier deployment requests received explicit HTTP 400 responses. No contract or transaction IDs were returned, and no deployment was completed. Future diagnostics expose only safe Circle code, message, validation field, and request ID values when available.

## 1. Prepare and preflight

Run `pnpm circle:config:check`, `pnpm circle:wallet:plan`, and `pnpm circle:contract:prepare`. Preparation checks the current generated ABI against the Foundry artifact, validates non-empty hexadecimal creation bytecode, derives `constructor(address,address,address,address,address)` from that ABI, and constructs the five parameters in this order: official Arc Testnet USDC, administrator, operator, arbitrator, pauser.

Estimate and execute mode retrieve the configured Circle wallet first. The record must match the configured ID/address, blockchain `ARC-TESTNET`, and account type `EOA`; developer custody and `LIVE` state are enforced when exposed.

## 2. Estimate the fee

```sh
pnpm circle:contract:estimate
```

This is the only live operation that is non-mutating. In its wallet-ID source mode, the Circle estimate request sends exactly `walletId`, `bytecode`, the ABI-derived `constructorSignature`, and `constructorParameters`. It deliberately omits `abiJson`, `blockchain`, and `sourceAddress`. Circle treats `abiJson` and `constructorSignature` as mutually exclusive for this estimate operation. ABI, blockchain `ARC-TESTNET`, and wallet address remain in the local validated preparation for wallet preflight, safe operator output, status validation, explorer links, and onchain verification.

The command prints only available safe medium-fee and request metadata, including `gasLimit`, `baseFee`, `priorityFee`, `maxFee`, `gasPrice`, `networkFee`, `networkFeeRaw`, and `l1Fee` when Circle supplies them. It does not require either network-fee field and is intentionally not part of `pnpm validate`. The real deployment request remains separate: it still includes ABI JSON and does not inherit this estimate-only omission.

## 3. Review the dry-run plan

```sh
pnpm circle:contract:deploy
```

This is the default and performs no Circle mutation. Review the wallet, bytecode length, ABI count, official USDC, roles, and fee level. ABI and bytecode are never printed.

## 4. Submit explicitly

Generate a UUIDv4 outside tracked files, then run:

```sh
pnpm circle:contract:deploy -- --execute --idempotency-key <uuid-v4>
```

The command performs all local checks and wallet preflight again, then submits exactly one wallet-ID `deployContract` request containing only `idempotencyKey`, `name`, `description`, `walletId`, `blockchain`, `abiJson`, `bytecode`, `constructorParameters`, and `fee`. Arc Testnet deployment uses the already validated canonical preparation value `ARC-TESTNET`. The API request omits `sourceAddress` and `constructorSignature`; neither is present with an undefined value. Actual deploy uses `walletId` and `blockchain` together, while estimate uses its separate wallet-ID source mode and omits `blockchain`; the two schemas must not be conflated.

Missing, invalid, or non-v4 keys and unknown arguments are rejected. Generate a UUIDv4 outside tracked files only when a deployment is deliberately submitted. Record any future validated result manually:

```text
CIRCLE_SETTLEMENT_CONTRACT_ID=
CIRCLE_DEPLOYMENT_TRANSACTION_ID=
```

The pipeline does not edit `.env` or create operation files.

## 5. Check or wait for status

```sh
pnpm circle:contract:status
pnpm circle:contract:status -- --wait
pnpm circle:contract:status -- --contract-id <uuid> --transaction-id <uuid> --wait --interval-seconds 5 --timeout-seconds 600
```

CLI IDs override environment IDs. Both Circle records must be `ARC-TESTNET`. `COMPLETE` is the required successful transaction state. `CANCELLED`, `DENIED`, `FAILED`, and `STUCK` are terminal failures; other documented states remain pending. Polling prints only changed states, has a two-second minimum interval and bounded timeout, and never submits or retries.

## 6. Verify on Arc Testnet

After Circle reports `COMPLETE` and supplies an address, the status command calls only `eth_chainId` and `eth_getCode` through the configured Arc RPC/fallback. It requires chain ID `5042002`, a valid non-zero address, and non-empty deployed bytecode, and validates any transaction hash before printing ArcScan links.

Then manually set `SETTLEMENT_CONTRACT_ADDRESS` and run:

```sh
pnpm contracts:deployment:verify
```

That independent read-only Foundry command—not the Circle status command—verifies roles and initial state. Complete `docs/deployment/DEPLOYMENT_EVIDENCE_TEMPLATE.md` with the IDs, transaction hash, address, ArcScan evidence, estimate, and Foundry verification output.