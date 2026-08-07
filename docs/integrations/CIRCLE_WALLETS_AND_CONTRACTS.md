# Circle Wallets and Contracts

## Purpose and current status

Settle uses Circle Developer-Controlled Wallets as the planned custody boundary for the Arc Testnet settlement deployment and initial operator activity. This foundation is server-only and does not place Circle credentials, entity-secret material, or signing material in browser code.

The configured Arc Testnet EOA predates this change. The first live Circle `deployContract` attempt was explicitly rejected with HTTP 400 before returning a contract ID or transaction ID. No wallet or wallet set was created, no deployment was completed, and no Circle contract deployment was retried during this coding task. Contract deployment remains a dry-run unless the operator supplies both `--execute` and a caller-generated UUIDv4 idempotency key.

## Why the first wallet is an Arc Testnet EOA

The initial wallet model is exactly one `ARC-TESTNET` externally owned account (`EOA`). It provides the simplest explicit deployment identity for `SettlementEscrow` and the initial operator role while keeping the first milestone narrowly auditable. Returned wallet metadata is accepted only when Circle reports `ARC-TESTNET`, account type `EOA`, and a valid non-zero EVM address.

Smart Contract Accounts and Circle Gas Station are intentionally deferred to a future milestone. That milestone should revisit fee sponsorship, account policy, role migration, and operational controls without changing the safety assumptions of this foundation.

## Server-side credential boundary

The Circle package is private and exports only a Node condition. Circle SDK clients are initialized lazily from explicit validated configuration; low-level client modules do not read `process.env` and no client is created at import time. Browser code must never import `@settle/circle`.

Required local placeholders are:

```text
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_WALLET_SET_ID=
CIRCLE_DEPLOYER_WALLET_ID=
CIRCLE_DEPLOYER_ADDRESS=
CIRCLE_SETTLEMENT_CONTRACT_ID=
CIRCLE_DEPLOYMENT_TRANSACTION_ID=
SETTLEMENT_CONTRACT_ADDRESS=
```

Empty and whitespace-only values are missing. `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` must never use a `NEXT_PUBLIC_` prefix. Scripts never print those values, never print the complete environment, and never write credentials to disk. Error normalization retains only a safe operation name, HTTP status, Circle validation code, sanitized Circle message, bounded field locations and messages, and sanitized request ID when those values are actually available from the known SDK error structures. It never publishes invalid values, raw SDK errors, raw request or response objects, authorization headers, ABI JSON, bytecode, or constructor values.

The reusable redactor covers Circle API keys, Circle entity secrets, `DEPLOYER_PRIVATE_KEY`, authorization headers, bearer tokens, and entity-secret ciphertext fields.

## Wallet set and wallet ID handling

Run the non-mutating checks and plan:

```sh
pnpm circle:config:check
pnpm circle:wallet:plan
```

If `CIRCLE_WALLET_SET_ID` is present, the plan reuses it and never creates a new wallet set. If `CIRCLE_DEPLOYER_WALLET_ID` is present, execute mode retrieves and validates it and never creates a new wallet. Wallet IDs are logged only where they describe a useful plan or approved result; wallet addresses may be logged.

An intentional mutation requires:

```sh
pnpm circle:wallet:create -- --execute \
  --wallet-set-idempotency-key <uuid> \
  --wallet-idempotency-key <uuid>
```

Provide only the idempotency key for each resource that is absent. The command may create or reuse one wallet set and one Arc Testnet EOA. It prints only wallet set ID, wallet ID, wallet address, blockchain, and account type, followed by the environment variable names to update. It does not update `.env`.

## Circle Contracts deployment workflow

`pnpm circle:contract:prepare` first runs the existing Foundry ABI freshness check. It then reads `packages/contracts/out/SettlementEscrow.sol/SettlementEscrow.json`, requires a non-empty ABI and non-empty creation bytecode, validates the deployer and all four role addresses, and creates an in-memory Circle Contracts preparation model. It does not call a Circle deployment endpoint and does not contain private signing material.

The canonical local preparation derives its constructor signature from the generated ABI and uses this exact parameter order:

1. Official Arc Testnet USDC: `0x3600000000000000000000000000000000000000`
2. Administrator address (`SETTLE_ADMIN_ADDRESS`)
3. Operator address (`SETTLE_OPERATOR_ADDRESS`)
4. Arbitrator address (`SETTLE_ARBITRATOR_ADDRESS`)
5. Pauser address (`SETTLE_PAUSER_ADDRESS`)

Before estimate or submission, Circle's `getWallet` operation must return the configured wallet ID and address, `ARC-TESTNET`, and `EOA`. Developer custody and `LIVE` state are also required when those fields are exposed.

`pnpm circle:contract:estimate` performs that preflight and then makes only Circle's non-mutating deployment-fee estimate request. In wallet-ID mode, its exact request field set is `walletId`, `bytecode`, the ABI-derived `constructorSignature`, and `constructorParameters`. It deliberately omits `abiJson`, `blockchain`, and `sourceAddress` because Circle treats `abiJson` and `constructorSignature` as mutually exclusive for this estimate operation.

Estimate output includes only available normalized medium-fee fields and safe request metadata; absent optional network-fee fields do not fail. ABI, bytecode, credentials, and complete SDK responses are never printed.

The wallet-ID-mode `deployContract` request contains exactly `idempotencyKey`, `name`, `description`, `walletId`, `abiJson`, `bytecode`, `constructorParameters`, and `fee`. It omits `blockchain`, `sourceAddress`, and `constructorSignature`. Address-based source mode is a separate API shape that would use `blockchain` plus `sourceAddress` instead of `walletId`. Blockchain `ARC-TESTNET`, deployer wallet address and ID, ABI, bytecode, constructor parameters, MEDIUM fee level, and contract metadata remain in the canonical local validated preparation for wallet preflight, dry-run output, status validation, explorer links, and onchain verification. Blockchain is omitted only at both wallet-ID API boundaries.

`pnpm circle:contract:deploy` prints a publication-safe plan by default and does not initialize Circle clients. Submission requires:

```sh
pnpm circle:contract:deploy -- --execute --idempotency-key <uuid-v4>
```

Generate the key outside the repository. The first live deploy attempt was explicitly rejected with HTTP 400 before Circle returned deployment IDs; preserve its existing external operation record and old idempotency key as validation-rejected evidence, but do not reuse that key for the corrected payload. Generate a fresh UUIDv4 only for a deliberate later corrected submission. Continue reusing the same key only for a genuinely ambiguous outcome where Circle may have accepted the same request. Record future returned IDs under `CIRCLE_SETTLEMENT_CONTRACT_ID` and `CIRCLE_DEPLOYMENT_TRANSACTION_ID`; the command never edits `.env`. No deployment was completed and the external operation record was not modified during this coding task.

Retrieve both records with `pnpm circle:contract:status`, optionally adding `-- --wait`. CLI `--contract-id` and `--transaction-id` values override environment values. Wait defaults to 5 seconds for 600 seconds, never polls faster than two seconds, prints only changes, succeeds only on transaction `COMPLETE`, and fails immediately on `CANCELLED`, `DENIED`, `FAILED`, or `STUCK`.

After `COMPLETE` and an available address, status checks Arc RPC chain ID `5042002` and requires non-empty `eth_getCode`, then prints ArcScan links. Put the verified address in `SETTLEMENT_CONTRACT_ADDRESS` manually and run `pnpm contracts:deployment:verify` for roles and initial state.

## Independent Foundry verification path

Foundry remains an independent simulation and fallback path. `pnpm contracts:deploy:simulate` exercises the existing deployment script without broadcast, and the contract build, format, tests, ABI freshness check, and post-deployment verification remain separate from Circle. This gives the Circle Contracts preparation a second implementation path against which constructor order, bytecode, ABI, roles, and Arc configuration can be reviewed.

## Commands

- `pnpm circle:config:check` — reports presence or absence without values or API calls.
- `pnpm circle:wallet:plan` — prints a dry-run reuse/create plan without SDK initialization.
- `pnpm circle:wallet:create` — remains a dry run unless `-- --execute` is supplied.
- `pnpm circle:contract:prepare` — builds/checks the artifact and prints a publication-safe preparation summary without submission.
- `pnpm circle:contract:estimate` — performs wallet preflight and a non-mutating Circle fee estimate.
- `pnpm circle:contract:deploy` — prints a dry-run plan; mutates only with explicit execution safeguards.
- `pnpm circle:contract:status` — retrieves Circle contract and transaction state; `--wait` optionally polls.

Live Circle mutations are not part of `pnpm validate`.