# Settle

Settle is API-first USDC payment and marketplace-settlement infrastructure built on Arc. The current test-mode foundation combines deterministic settlement contracts, Circle-controlled operations, a buyer checkout experience, merchant identity and onboarding, tenant-safe PostgreSQL persistence, and revocable merchant API keys.

## Repository

- `apps/web`: Next.js public demo, buyer checkout, WorkOS sign-in, onboarding, and merchant shell
- `packages/contracts`: Foundry settlement contracts and Solidity tests
- `packages/circle`: Circle wallet/contract operator tooling and integrity checks
- `packages/db`: Drizzle schema, migrations, tenant-aware repositories, identity persistence, and API-key lifecycle
- `packages/shared`: shared protocol, validation, and canonical lifecycle primitives
- `docs/productization`: implementation plans, security boundaries, and slice evidence

Arc `SettlementEscrow` remains canonical for payment and settlement facts. Database state is an operational projection and must never override contradictory chain state.

## Development

Prerequisites:

- Node.js 22 or newer and Corepack
- Foundry, including `forge`
- Neon PostgreSQL pooled and direct endpoints for database work
- WorkOS AuthKit credentials for merchant sign-in flows

Install the pinned JavaScript, OpenZeppelin Contracts, and forge-std dependencies:

```sh
corepack enable
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env` and populate only the integrations you intend to run. Never commit `.env`. Runtime database traffic uses pooled `DATABASE_URL`; migrations use direct `DATABASE_MIGRATION_URL`. The database configuration rejects non-Neon endpoints, optional TLS, and pooled/direct URLs that do not identify the same endpoint, role, and database.

## Database and merchant API keys

```sh
pnpm --filter @settle/db config:check
pnpm --filter @settle/db db:generate
pnpm --filter @settle/db db:migrate
pnpm --filter @settle/db db:validate
pnpm --filter @settle/db test:integration
```

Create or reuse an active test merchant and issue a one-time test API key:

```sh
pnpm --filter @settle/db merchant:bootstrap:test -- --name "Example Merchant" --slug example-merchant
```

The command prints the plaintext key once. Settle stores only a versioned HMAC-SHA256 digest and safe prefix. Keys are tenant-scoped, scope-limited, expirable, auditable, and immediately revocable.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:web
pnpm contracts:fmt:check
pnpm contracts:test
pnpm validate
```

The Circle test command builds the Foundry artifact first, so a clean checkout does not depend on a previously generated contract artifact.

## License

Apache-2.0.
