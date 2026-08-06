# Circle Wallets and Contracts

## Purpose and current status

Settle uses Circle Developer-Controlled Wallets as the planned custody boundary for the Arc Testnet settlement deployment and initial operator activity. This foundation is server-only and does not place Circle credentials, entity-secret material, or signing material in browser code.

No Circle wallet creation and no Circle contract deployment has been executed by this integration as of this change. The default commands are read-only configuration checks, dry-run plans, and local artifact preparation. A wallet mutation is possible only through the separately named command with an explicit `--execute` flag. Contract submission is not implemented.

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
```

Empty and whitespace-only values are missing. `CIRCLE_API_KEY` and `CIRCLE_ENTITY_SECRET` must never use a `NEXT_PUBLIC_` prefix. Scripts never print those values, never print the complete environment, and never write credentials to disk. Error normalization retains only a safe operation name, HTTP status, Circle error code, and request ID.

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

## Circle Contracts deployment plan

`pnpm circle:contract:prepare` first runs the existing Foundry ABI freshness check. It then reads `packages/contracts/out/SettlementEscrow.sol/SettlementEscrow.json`, requires a non-empty ABI and non-empty creation bytecode, validates the deployer and all four role addresses, and creates an in-memory Circle Contracts preparation model. It does not call a Circle deployment endpoint and does not contain private signing material.

The exact Solidity constructor parameter order is:

1. Official Arc Testnet USDC: `0x3600000000000000000000000000000000000000`
2. Administrator address (`SETTLE_ADMIN_ADDRESS`)
3. Operator address (`SETTLE_OPERATOR_ADDRESS`)
4. Arbitrator address (`SETTLE_ARBITRATOR_ADDRESS`)
5. Pauser address (`SETTLE_PAUSER_ADDRESS`)

The printed summary contains the contract name, blockchain, deployer wallet ID and address, bytecode length, ABI entry count, four role addresses, and official USDC address. It never prints full bytecode or the complete ABI.

## Independent Foundry verification path

Foundry remains an independent simulation and fallback path. `pnpm contracts:deploy:simulate` exercises the existing deployment script without broadcast, and the contract build, format, tests, ABI freshness check, and post-deployment verification remain separate from Circle. This gives the Circle Contracts preparation a second implementation path against which constructor order, bytecode, ABI, roles, and Arc configuration can be reviewed.

## Commands

- `pnpm circle:config:check` — reports presence or absence without values or API calls.
- `pnpm circle:wallet:plan` — prints a dry-run reuse/create plan without SDK initialization.
- `pnpm circle:wallet:create` — remains a dry run unless `-- --execute` is supplied.
- `pnpm circle:contract:prepare` — builds/checks the artifact and prints a publication-safe preparation summary without submission.

Live Circle mutations are not part of `pnpm validate`.