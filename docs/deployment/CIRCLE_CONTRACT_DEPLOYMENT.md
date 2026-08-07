# Circle Contract Deployment

## Current status

The production-safe Circle deployment pipeline is implemented. The first live `deployContract` attempt was explicitly rejected with HTTP 400 before Circle returned a contract ID or transaction ID. That operation is validation-rejected evidence, not an ambiguous networking outcome. **No deployment was completed, no request was retried, and no mutating Circle or Arc request was made during this coding task.**

## 1. Prepare and preflight

Run `pnpm circle:config:check`, `pnpm circle:wallet:plan`, and `pnpm circle:contract:prepare`. Preparation checks the current generated ABI against the Foundry artifact, validates non-empty hexadecimal creation bytecode, derives `constructor(address,address,address,address,address)` from that ABI, and constructs the five parameters in this order: official Arc Testnet USDC, administrator, operator, arbitrator, pauser.

Estimate and execute mode retrieve the configured Circle wallet first. The record must match the configured ID/address, blockchain `ARC-TESTNET`, and account type `EOA`; developer custody and `LIVE` state are enforced when exposed.

## 2. Estimate the fee

```sh
pnpm circle:contract:estimate
```

This is the only live operation that is non-mutating. In wallet-ID mode, the Circle estimate request sends exactly `walletId`, `bytecode`, the ABI-derived `constructorSignature`, and `constructorParameters`. It deliberately omits `abiJson`, `blockchain`, and `sourceAddress`. Circle treats `abiJson` and `constructorSignature` as mutually exclusive for this estimate operation. ABI, blockchain `ARC-TESTNET`, and wallet address remain in the local validated preparation for wallet preflight, safe operator output, status validation, explorer links, and onchain verification.

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

The command performs all local checks and wallet preflight again, then submits exactly one wallet-ID-mode `deployContract` request containing only `idempotencyKey`, `name`, `description`, `walletId`, `abiJson`, `bytecode`, `constructorParameters`, and `fee`. The API request omits `blockchain`, `sourceAddress`, and `constructorSignature`; none are present with undefined values. Blockchain remains `ARC-TESTNET` in the canonical local preparation. Address-based source mode is a different request shape and would require `blockchain` plus `sourceAddress` instead of `walletId`.

Missing, invalid, or non-v4 keys and unknown arguments are rejected. The first live attempt received an explicit HTTP 400 and no deployment IDs, so its idempotency key must be retained with the existing failed operation record as validation-rejected evidence and must not be reused for the corrected payload. Generate a fresh UUIDv4 only when the corrected request is deliberately submitted later. Reuse the same key only for a genuinely ambiguous outcome where Circle may have accepted that same request. Record any future validated result manually:

```text
CIRCLE_SETTLEMENT_CONTRACT_ID=
CIRCLE_DEPLOYMENT_TRANSACTION_ID=
```

The pipeline does not edit `.env` or create operation files. The existing external operation record was not modified during this coding task, and no deployment was completed.

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