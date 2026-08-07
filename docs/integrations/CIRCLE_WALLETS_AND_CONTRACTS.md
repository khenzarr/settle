# Circle Wallets and Contracts

## Purpose and current status

Settle uses Circle Developer-Controlled Wallets as the planned custody boundary for the Arc Testnet settlement deployment and initial operator activity. This foundation is server-only and does not place Circle credentials, entity-secret material, or signing material in browser code.

The configured Arc Testnet EOA predates this change. Circle contract descriptions for this deployment operation must be strictly alphanumeric (`^[A-Za-z0-9]+$`). Settle uses `SettleUSDCSettlementArcTestnet`; punctuation and whitespace are deliberately avoided. A prior request was explicitly rejected on the `description` field with HTTP 400. No contract or transaction ID was returned, and no deployment completed during that attempt. Future diagnostics expose only safe Circle code, message, validation field, and request ID values when available. Contract deployment remains a dry-run unless the operator supplies both `--execute` and a caller-generated UUIDv4 idempotency key.

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

`pnpm circle:contract:estimate` performs that preflight and then makes only Circle's non-mutating deployment-fee estimate request. In its wallet-ID source mode, its exact request field set is `walletId`, `bytecode`, the ABI-derived `constructorSignature`, and `constructorParameters`. It deliberately omits `abiJson`, `blockchain`, and `sourceAddress` because Circle treats `abiJson` and `constructorSignature` as mutually exclusive for this estimate operation.

Estimate output includes only available normalized medium-fee fields and safe request metadata; absent optional network-fee fields do not fail. ABI, bytecode, credentials, and complete SDK responses are never printed.

The wallet-ID `deployContract` request contains exactly `idempotencyKey`, `name`, `description`, `walletId`, `blockchain`, `abiJson`, `bytecode`, `constructorParameters`, and `fee`. Actual deploy uses `walletId` and `blockchain` together, and Arc Testnet deploys use the already validated canonical preparation value `ARC-TESTNET`. This wallet-ID deployment omits `sourceAddress` and `constructorSignature`. Estimate intentionally uses its separate wallet-ID source mode and omits `blockchain`; estimate and deploy have different schemas and must not be conflated. Deployer wallet address and ID, ABI, bytecode, constructor parameters, MEDIUM fee level, and contract metadata remain in the canonical local validated preparation for wallet preflight, dry-run output, status validation, explorer links, and onchain verification.

`pnpm circle:contract:deploy` prints a publication-safe plan by default and does not initialize Circle clients. Submission requires:

```sh
pnpm circle:contract:deploy -- --execute --idempotency-key <uuid-v4>
```

Generate the key outside the repository only for a deliberate submission. Record future returned IDs under `CIRCLE_SETTLEMENT_CONTRACT_ID` and `CIRCLE_DEPLOYMENT_TRANSACTION_ID`; the command never edits `.env`.

Retrieve both records with `pnpm circle:contract:status`, optionally adding `-- --wait`. CLI `--contract-id` and `--transaction-id` values override environment values. Wait defaults to 5 seconds for 600 seconds, never polls faster than two seconds, prints only changes, succeeds only on transaction `COMPLETE`, and fails immediately on `CANCELLED`, `DENIED`, `FAILED`, or `STUCK`.

After `COMPLETE` and an available address, status checks Arc RPC chain ID `5042002` and requires non-empty `eth_getCode`, then prints ArcScan links. Put the verified address in `SETTLEMENT_CONTRACT_ADDRESS` manually and run `pnpm contracts:deployment:verify` for roles and initial state.

## Independent Foundry verification path

Foundry remains an independent simulation and fallback path. `pnpm contracts:deploy:simulate` exercises the existing deployment script without broadcast, and the contract build, format, tests, ABI freshness check, and post-deployment verification remain separate from Circle. This gives the Circle Contracts preparation a second implementation path against which constructor order, bytecode, ABI, roles, and Arc configuration can be reviewed.

## Commands

- `pnpm circle:config:check` — reports presence or absence without values or API calls.
- `pnpm circle:wallet:plan` — prints a dry-run reuse/create plan without SDK initialization.
- `pnpm circle:wallet:create` — remains a dry run unless `-- --execute` is supplied.
- `pnpm circle:wallet:send` — prepares a guarded wallet transfer and defaults to dry run.
- `pnpm circle:wallet:contract-call` — prepares a generic guarded contract execution and defaults to dry run.
- `pnpm circle:contract:prepare` — builds/checks the artifact and prints a publication-safe preparation summary without submission.
- `pnpm circle:contract:estimate` — performs wallet preflight and a non-mutating Circle fee estimate.
- `pnpm circle:contract:deploy` — prints a dry-run plan; mutates only with explicit execution safeguards.
- `pnpm circle:contract:status` — retrieves Circle contract and transaction state; `--wait` optionally polls.

### Read-only wallet operations

The following operator commands inspect the configured Circle Developer-Controlled Wallet and do not send funds, create transactions, execute contracts, deploy anything, call Circle mutation endpoints, or generate idempotency keys:

- `pnpm circle:wallet:info` — retrieves and validates wallet metadata, including the `ARC-TESTNET` blockchain, public address, EOA account type, optional developer custody and live state, and an ArcScan address link. The wallet ID is used internally and is not printed.
- `pnpm circle:wallet:balances` — lists all token balances indexed by Circle for the configured wallet. Use `-- --token-address <0x...>` for an address-specific query. Native USDC and the canonical ERC-20 USDC address `0x3600000000000000000000000000000000000000` are displayed as alternate views and are never added together. Circle-indexed reward tokens are retained when returned.
- `pnpm circle:wallet:transactions` — lists the most recent 10 Circle transaction-history records for this wallet. Use `-- --page-size <1-50>` for a bounded alternative. The query is scoped by wallet ID and requests monitored and non-monitored records with `includeAll` where supported. Circle rejects combining its wallet-ID and blockchain filters, so the command validates every returned record as `ARC-TESTNET` locally instead of sending an incompatible filter combination.
- `pnpm circle:wallet:transaction-status -- --transaction-id <uuid>` — retrieves exactly one requested transaction with the installed SDK `getTransaction({ id })` method and validates its returned ID, `ARC-TESTNET` blockchain, and configured wallet ownership when Circle exposes a wallet ID. Add `--wait` for bounded read-only polling; optional controls are `--interval-seconds <2-3600>` and `--timeout-seconds <interval-3600>`.

The transaction-status command is the durable status/recovery primitive after `wallet:send` or `wallet:contract-call` returns a valid transaction ID. A `submitted` or otherwise non-terminal transaction is not finality: check it until `COMPLETE`, or until Circle reports a terminal failure. An ambiguous mutation outcome must be diagnosed with the same transaction ID; do not create a replacement idempotency key or blindly submit a new mutation. This command itself is always read-only, never retries or submits mutations, and never changes external operation records.

The installed Developer-Controlled Wallets 10.8.0 transaction state model is `INITIATED`, `CLEARED`, `QUEUED`, `SENT`, `STUCK`, `CONFIRMED`, `COMPLETE`, `FAILED`, `DENIED`, or `CANCELLED`. Settle treats only `COMPLETE` as terminal success and `STUCK`, `FAILED`, `DENIED`, and `CANCELLED` as terminal failures; all earlier pipeline states remain pending/non-terminal. Output is publication-safe and omits the configured wallet ID, credentials, entity secret, ciphertext, headers, raw SDK responses, request bodies, and idempotency keys.

Circle wallet history and balances have the scope and completeness guarantees of Circle's indexed API; these commands are not a complete chain indexer. If a future reward token is not surfaced by Circle's balance index, that does not prove the onchain balance is zero. A later read-only token-address-specific Arc RPC fallback may be added if needed; this phase does not build a general-purpose token indexer.

### Guarded wallet mutations

`pnpm circle:wallet:send` and `pnpm circle:wallet:contract-call` are the generic primitives through which the configured Developer-Controlled Wallet can later move assets or execute contracts without exposing a raw EVM private key. They are not SettlementEscrow-specific commands and do not implement release, refund, pause, or role operations.

#### Dry run

Dry run is the default. It parses every argument, validates the configured public wallet address, and prints a publication-safe plan without constructing a Circle SDK client, reading Circle credentials, calling wallet preflight, generating an idempotency key, or calling a Circle mutation endpoint.

```sh
pnpm circle:wallet:send -- \
  --destination <non-zero-evm-address> \
  --amount 1.25 \
  --token-address <non-zero-evm-token-address> \
  --fee-level MEDIUM

pnpm circle:wallet:contract-call -- \
  --contract <non-zero-evm-contract-address> \
  --function 'transfer(address,uint256)' \
  --parameters '["<recipient-address>","1000000"]' \
  --fee-level MEDIUM
```

Transfer amounts are exact plain decimal strings. Signs, exponent notation, zero, negative values, leading-zero ambiguity, and floating-point conversion are rejected. Contract parameters are a JSON array of SDK-supported strings, safe integers, booleans, or nested arrays. Large integer ABI values should be quoted as strings. Normal contract-call output prints the function signature and parameter count, not the raw parameter array or calldata.

The installed `@circle-fin/developer-controlled-wallets@10.8.0` transfer method is `createTransaction(CreateTransferTransactionInput)`. With the configured source selected by `walletId`, the request accepts exactly one of:

- `tokenId`: Circle's system-generated token identifier; or
- `tokenAddress`: the token's blockchain address, together with `blockchain: ARC-TESTNET`.

The installed SDK declaration makes `blockchain` optional on its token-address
token input and marks it incompatible with `walletId`, but Circle runtime
validation requires the blockchain whenever `tokenId` is absent. Settle sends
the canonical `ARC-TESTNET` value for the token-address branch. The token-ID
branch omits `blockchain` and sends only `tokenId` as its token reference.

Both forms are exposed because the installed SDK supports both. `--token-id` and `--token-address` are mutually exclusive. Native-token transfer semantics require Circle token metadata and should use the appropriate Circle token ID; this command does not invent an empty-address CLI convention or infer token IDs from symbols. Balance metadata may display Circle token IDs internally, but automatic resolution is deliberately avoided because symbols and alternate Arc USDC views are not a unique mutation identifier.

The installed contract method is `createContractExecutionTransaction(CreateContractExecutionTransactionInput)`. It natively supports either ABI function signature plus ABI parameters, or raw calldata. Settle selects the native ABI mode (`--function` plus `--parameters`) so no calldata is hand-built and no additional web3 encoder dependency is needed. Optional `--amount` is a non-negative plain decimal native-token value for payable calls; operators should omit it for non-payable calls.

Both SDK methods require a `fee` configuration. The CLI exposes the SDK's dynamic `LOW`, `MEDIUM`, or `HIGH` fee levels and defaults to `MEDIUM`. The installed SDK also supports absolute EIP-1559 values and gas-price configuration, but those are intentionally not exposed without a coupled estimate workflow.

#### Execution

Future execution requires both controls in the same invocation:

```sh
pnpm circle:wallet:send -- <transfer-arguments> --execute --idempotency-key <caller-generated-uuid-v4>
pnpm circle:wallet:contract-call -- <contract-arguments> --execute --idempotency-key <caller-generated-uuid-v4>
```

The commands reject `--execute` without a UUIDv4 key, a key without `--execute`, duplicate flags, unknown flags, and missing flag values. They never generate a key and never print it. Execution constructs the SDK client only after all local input validation, then reuses the existing configured-wallet preflight to require the matching wallet ID, public address, `ARC-TESTNET`, `EOA`, developer custody, and live state. One invocation calls its mutation gateway at most once and performs no automatic retry.

Although the high-level SDK input marks `idempotencyKey` optional and can generate one when omitted, the underlying generated mutation request requires UUIDv4 and documents that reuse returns the original response. Settle deliberately makes the caller-supplied UUIDv4 mandatory. If submission fails ambiguously, preserve the SAME idempotency key and diagnose the existing request before any retry; never create a replacement key merely because the first result was unclear.

A successful submission response must contain a structurally valid transaction UUID and state. Acceptance is never described as finality. `getTransaction({ id })` is the installed retrieval method for later status confirmation and exposes state plus transaction hash when available.

#### Verified live outbound transfer

D3B3B1 implemented and tested this mutation tooling entirely through mocked gateways. Dry-run support remains the default and does not submit a transaction. The following controlled D3B3B2A2 live proof used exactly one mutation submission with no automatic retry. It is recorded here as integration evidence; no idempotency key or secret is recorded.

- Operation: outbound transfer on `ARC-TESTNET`
- Circle transaction ID: `52742ef5-876b-52a6-a1a7-67286c79513e`
- Circle state progression: `INITIATED` -> `SENT` -> `COMPLETE`
- Transferred amount: `0.010000 USDC`
- Circle-reported network fee: `0.00196119035`
- Source: `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`
- Destination: `0x0b943fe9f1f8135e0751ba8b43dc0cd688ad209d`
- Canonical USDC: `0x3600000000000000000000000000000000000000`
- Arc transaction hash: `0x4a3bdf62bcbdfe44dbc71d920f5e8fc10efcba254173481abadeb7cdbd9c7b8c`
- Arc block: `55816895`
- ArcScan: <https://testnet.arcscan.app/tx/0x4a3bdf62bcbdfe44dbc71d920f5e8fc10efcba254173481abadeb7cdbd9c7b8c>

Circle-reported `COMPLETE` is the recorded Circle finality state. Independent Arc RPC verification also confirmed a successful transaction receipt, the canonical USDC `Transfer` event, and matching source, destination, and amount. This onchain proof is separate from Circle submission and status reporting.

The source balance view changed from `19.902646 USDC` to `19.890685 USDC`, while the recipient changed from `1042.841524 USDC` to `1042.851524 USDC`. The observed recipient delta was `+0.010000 USDC`; the observed source debit at 6-decimal token-accounting precision was `0.011961 USDC`. The source debit can exceed the transferred token amount because Arc network fees are paid from the same USDC-denominated balance view. The debit should not be treated as an exact 6-decimal rendering of transfer amount plus the separately reported fee.

The corrected token-address request included `blockchain: ARC-TESTNET`. Circle runtime requires this field when `tokenAddress` is used, even though the installed Developer-Controlled Wallets SDK 10.8.0 typing permits its omission in that token input. The earlier request was rejected by Circle with HTTP 400 before transaction creation because it omitted `blockchain`; it created no transaction and moved no funds.

#### Verified live contract execution

D3B3B2B2 established the guarded live contract-execution path, and D3B3B2B3 recorded one controlled live proof against the canonical deployed `SettlementEscrow` at `0x3e438ae878a8dc02c83f5545047cbde33a4f795f` on `ARC-TESTNET` (chain ID `5042002`). The generic contract-call command remains dry-run by default: dry run validates inputs and prints a safe plan without initializing the Circle client, reading credentials, generating an idempotency key, or calling a mutation endpoint. This evidence records the separate execution proof and contains no idempotency key or secret.

Circle accepted exactly one `createContractExecutionTransaction` mutation submission. The resulting Circle operation was `CONTRACT_EXECUTION`, with transaction ID `d1cec9f7-908d-5476-ab78-e8276b86e552`, and its observed state progression was `INITIATED` -> `SENT` -> `COMPLETE`. The Circle-reported network fee was `0.00071392179159`. The configured wallet and transaction sender was `0x4ac8d35f1795531f1e0bef3826db5aab730fcd34`.

The target function was Solidity `paused()`, with ABI signature `paused()` and no parameters. It was selected because it is a view function with no escrow lifecycle semantics and no fund-transfer behavior, making it suitable for proving contract-execution transport while avoiding intentional application-state mutation. Circle did not perform `eth_call`: Circle submitted an actual EVM transaction to the contract through `createContractExecutionTransaction`; the Solidity function invoked by that transaction is itself view/read-only.

Public transaction evidence:

- Target contract: `0x3e438ae878a8dc02c83f5545047cbde33a4f795f`
- Function and calldata: `paused()`, `0x5c975abb`
- Transaction value: `0`
- Arc transaction hash: `0x9b5a3a4141c6d4b743f81c9eeb74dde7f6af570bd2c062ba05b109d8045375a5`
- Arc block: `55820737`
- ArcScan: <https://testnet.arcscan.app/tx/0x9b5a3a4141c6d4b743f81c9eeb74dde7f6af570bd2c062ba05b109d8045375a5>

After Circle reported `COMPLETE`, independent Arc RPC verification confirmed that the transaction existed, the receipt succeeded, the transaction sender matched the configured Circle wallet, both transaction and receipt `to` values matched the canonical `SettlementEscrow`, the input exactly matched selector `0x5c975abb`, the value was zero, and the block was `55820737`. Circle `COMPLETE` and this independent transaction/receipt proof are distinct stages of the evidence.

Pre-state checks confirmed chain ID `5042002`, deployed runtime bytecode, settlement token `0x3600000000000000000000000000000000000000` with 6 decimals, administrator/operator/arbitrator/pauser roles, `paused: false`, `totalActiveEscrow: 0`, and runtime integrity exact after immutable substitution. Post-state checks confirmed `paused: false`, `totalActiveEscrow: 0`, and the same runtime integrity. Therefore the observed state was `paused: false -> false` and `totalActiveEscrow: 0 -> 0`; no escrow lifecycle state, role state, token transfer, or value transfer was changed.

This proof demonstrates the Circle Developer-Controlled Wallet contract-execution primitive against the deployed canonical contract. A successful transaction invoking a view function does not prove that any state-changing `SettlementEscrow` lifecycle function has been exercised or validated.

## Long-term wallet access

The Circle Developer-Controlled Wallet does not expose a conventional raw EVM private key. Normal wallet control is provided through Circle's Developer-Controlled Wallet infrastructure and authenticated server-side operations. Settle's read-only operator surface provides durable access to wallet metadata, balances, and inbound/outbound transaction history without exporting a raw private key. The guarded mutation foundation above adds separately controlled transfer and generic contract-execution preparation while preserving dry run as the default.

Live Circle mutations are not part of `pnpm validate`.