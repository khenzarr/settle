# Settle

Settle is marketplace settlement software built on Arc Testnet infrastructure.

This repository currently contains the project foundation only:

- `apps/web`: Next.js web application
- `packages/shared`: shared TypeScript package
- `packages/contracts`: Foundry smart contract package

## Development

Prerequisites:

- Node.js and Corepack
- Foundry (including `forge`)

Install the pinned JavaScript, OpenZeppelin Contracts, and forge-std dependencies from the lockfile:

```sh
corepack enable
pnpm install --frozen-lockfile
```

The Foundry dependencies are regular pnpm packages. No Git submodules, user-specific paths, or separate `forge install` step are required.

Run the root checks:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
pnpm contracts:fmt:check
pnpm contracts:test
pnpm validate
```

## License

This project is licensed under Apache-2.0.