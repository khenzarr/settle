# SettlementEscrow ABI pipeline

The `SettlementEscrow` ABI is generated from the Foundry build artifact at:

`packages/contracts/out/SettlementEscrow.sol/SettlementEscrow.json`

The generated TypeScript module is committed at:

`packages/shared/src/abi/SettlementEscrow.ts`

Run `pnpm contracts:abi` from the repository root to build the Foundry project and regenerate the TypeScript ABI. Run `pnpm contracts:abi:check` to build the project and verify that the committed ABI is current without rewriting it.

The generated ABI file is committed so TypeScript consumers of `packages/shared` have a stable contract interface without requiring Foundry or its build output. Foundry's `out` directory is not committed because it contains reproducible build artifacts and data beyond the public ABI.

Any change to `packages/contracts/src/SettlementEscrow.sol` that changes the contract interface must be followed by `pnpm contracts:abi`. The generated file should be reviewed and committed with the contract change. The root validation pipeline runs the freshness check and fails when generated output is missing or stale.

The export pipeline reads only the artifact's `abi` property. It does not expose bytecode, metadata, build identifiers, source paths, or other Foundry artifact content.