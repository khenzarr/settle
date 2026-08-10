# M1.A2 Persistence implementation

`@settle/db` is a server-only Drizzle package for PostgreSQL operational state. Arc `SettlementEscrow` remains canonical for payment and settlement facts; database `canonical_status` fields are observations and never override contradictory chain state.

## Connections and migrations

Runtime uses pooled `DATABASE_URL` through `@neondatabase/serverless` `Pool`, which supports explicit Drizzle transactions. Drizzle Kit and migration application use direct `DATABASE_MIGRATION_URL`; the config fails closed when it is absent and never falls back. Generate and review SQL with `pnpm --filter @settle/db db:generate`, then apply only after verifying the Neon `development` branch. Production is read-only for this phase.

The package is organized into `src/schema` table definitions, `src/repositories` tenant-aware data access, `src/client.ts` pooled runtime construction, `src/transaction.ts` transaction types/helpers, `scripts` migration and validation entry points, `tests` unit/integration coverage, and `drizzle` versioned SQL plus snapshots. Every runtime data-access entry point imports `server-only`; ordinary static builds do not construct a database client or require a connection.

## Schema

The migration creates exactly: `merchants`, `merchant_members`, `merchant_environments`, `merchant_settings`, `payment_intents`, `payment_intent_recipients`, `chain_orders`, `idempotency_keys`, and `audit_events`. Merchant/environment foreign keys, tenant-prefixed unique constraints, lifecycle enums, normalized EVM-address checks, deadline checks, and indexes are defined in `src/schema`.

USDC amounts and chain IDs use PostgreSQL `numeric(78,0)` with Drizzle bigint mapping. `0.05 USDC` is stored as `50000`; floating point is not a canonical representation. Recipient validation requires 1–8 unique recipients totaling 10,000 BPS.

## Boundaries and transactions

`MerchantRepository`, `PaymentIntentRepository`, `IdempotencyRepository`, and `AuditRepository` accept a tenant context where applicable. Payment intent creation with recipients is intended to run with `withTransaction`, allowing M1.C to atomically persist intent, recipients, chain mapping, idempotency state, and audit evidence.

Repository lookups use merchant and environment together. External order uniqueness and idempotency-key uniqueness are tenant-prefixed, while composite foreign keys ensure an environment belongs to the same merchant as each payment intent, idempotency record, or tenant audit event. `withTransaction` exposes the Drizzle transaction executor so all participating repositories can share one PostgreSQL transaction and roll back as a unit.

## Migration workflow

1. Run `pnpm --filter @settle/db config:check` and independently confirm both endpoints target Neon project `settle`, branch `development`.
2. Generate versioned SQL with `pnpm --filter @settle/db db:generate`.
3. Read the complete SQL and reject unexpected `DROP` or destructive `ALTER` statements.
4. Run `git diff --check`.
5. Apply with `pnpm --filter @settle/db db:migrate`; this command uses only `DATABASE_MIGRATION_URL`.
6. Validate with `pnpm --filter @settle/db db:validate` and `pnpm --filter @settle/db test:integration`.

Production is never a migration target in M1.A2. Its Neon branch remains unchanged and read-only for this work; there is no fallback from the direct development migration URL to the pooled runtime URL.

## Validation and deferred work

Unit tests cover fail-closed configuration and exact recipient allocation. Development validation checks all nine tables, migration history, primary and foreign keys, indexes, integer base units, and rollback. Integration tests use isolated synthetic records inside dedicated-client transactions, prove rollback, and prove an idempotency digest conflicts within one tenant while remaining reusable by another tenant.

Merchant API keys and authentication-provider integration (M1.B), the public Payment Intent write API (M1.C), webhooks, reconciliation workers, merchant dashboard, CCTP, and Arc mainnet support remain deferred. No contract behavior or canonical Arc settlement semantics changed in this phase.