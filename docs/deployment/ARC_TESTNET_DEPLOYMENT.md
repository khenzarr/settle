# Arc Testnet Deployment

This runbook prepares and verifies a `SettlementEscrow` deployment on Arc Testnet. It does not configure Arc mainnet values. Testnet USDC has no real-world value.

## Prerequisites

- Node.js with Corepack and the repository-pinned `pnpm` version.
- Foundry `1.7.1` or a later compatible version that supports Solidity `0.8.30`, `forge script`, and `forge lint` diagnostics.
- An Arc Testnet RPC endpoint. The official fallback used by the public preflight is `https://rpc.testnet.arc.network`.
- A dedicated testnet deployer and four reviewed role addresses.
- Arc Testnet gas funding obtained through the official Arc faucet. Confirm the current official faucet URL from Arc documentation before use.

Simulation is not deployment. Deployment is not complete until post-deployment verification passes.

## Local environment setup

Copy `.env.example` to a local ignored `.env` file or inject the variables through your shell or secret manager:

```text
ARC_TESTNET_RPC_URL=
DEPLOYER_PRIVATE_KEY=
SETTLE_ADMIN_ADDRESS=
SETTLE_OPERATOR_ADDRESS=
SETTLE_ARBITRATOR_ADDRESS=
SETTLE_PAUSER_ADDRESS=
SETTLEMENT_CONTRACT_ADDRESS=
```

Use only local testnet values. Never store signing material, populated environment files, keystores, or shell history containing signing values in Git. Do not expose deployment values through `NEXT_PUBLIC_` variables.

The deployment and verification commands require `ARC_TESTNET_RPC_URL`. The public preflight treats an empty override as absent and falls back to the official public endpoint.

## RPC preflight

```sh
pnpm contracts:preflight:arc
```

The preflight verifies chain ID `5042002`, deployed code at official USDC `0x3600000000000000000000000000000000000000`, and six ERC-20 decimals. It prints only the credential-free RPC origin.

## Simulation

Load the local environment using a method appropriate for your shell or secret manager, then run:

```sh
pnpm contracts:deploy:simulate
```

Review the complete Foundry simulation output, sender, constructor arguments, estimated gas, and any RPC errors. No `--broadcast` flag is present. A successful simulation is not an onchain deployment.

## Broadcast

Only after preflight, role review, deployer funding, and simulation approval, run the separate explicit command:

```sh
pnpm contracts:deploy:broadcast
```

This is the only root command configured to broadcast. Record the transaction hash and deployed address immediately. Do not place either value in source configuration unless a separately reviewed change requires it.

## Post-deployment verification

Set `SETTLEMENT_CONTRACT_ADDRESS` to the deployed contract and run:

```sh
pnpm contracts:deployment:verify
```

The read-only script checks deployed bytecode, official USDC and decimals, all four initial role grants, the unpaused state, and zero initial active escrow. It never broadcasts. Deployment is not complete until this command passes against Arc Testnet.

## ArcScan inspection and role verification

Open `https://testnet.arcscan.app/address/<SETTLEMENT_CONTRACT_ADDRESS>` and inspect:

1. The contract creation transaction and deployment block.
2. The deployer address and constructor arguments.
3. The official USDC address.
4. `DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`, `ARBITRATOR_ROLE`, and `PAUSER_ROLE` membership using the verification script output and contract reads.
5. The absence of unexpected follow-up transactions.

Record the address link and transaction link in the evidence template.

## Evidence recording

Copy `docs/deployment/DEPLOYMENT_EVIDENCE_TEMPLATE.md` into the controlled deployment record. Fill fields only from observed command output, ArcScan, the source revision, and approved role records. Do not fabricate missing values or add private keys, mnemonics, credentials, or full credential-bearing RPC URLs.

## Failure recovery

- **Preflight fails:** stop. Check connectivity, safe RPC configuration, chain ID, official USDC bytecode, and decimals.
- **Simulation fails:** stop. Correct local environment, role addresses, deployer funding assumptions, or RPC issues; rerun preflight and simulation.
- **Broadcast is uncertain:** do not immediately retry. Search ArcScan by deployer address and transaction hash, and query the account nonce to determine whether a transaction was accepted.
- **Verification fails:** treat the deployment as incomplete. Preserve evidence, do not use the contract, diagnose the exact mismatch, and prepare a new reviewed deployment if the immutable constructor configuration is wrong.
- **Signing material is exposed:** stop using it, rotate the testnet key, remove it from local history and logs, and assess repository history before continuing.

No Arc mainnet RPC, chain ID, token address, or deployment address is configured by this workflow.