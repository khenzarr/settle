# M1.A2 Persistence implementation

`@settle/db` is a server-only Drizzle package for PostgreSQL operational state. Arc `SettlementEscrow` remains canonical for payment and settlement facts; database status fields are observations and never override contradictory chain state.

## Connections and migrations

Runtime uses pooled `DATABASE_URL` through `@neondatabase/serverless` `Pool`, which supports explicit Drizzle transactions. Drizzle Kit and migration application use direct `DATABASE_MIGRATION_URL`; configuration fails closed when it is absent and never falls back. Both URLs must use Neon, require TLS, and identify the same endpoint, role, and database while retaining pooled/direct separation.

Generate and review SQL with `pnpm --filter @settle/db db:generate`, then apply only after independently verifying the intended Neon project and branch. The package is organized into `src/schema`, tenant-aware `src/repositories`, pooled `src/client.ts`, transaction helpers, scripts, tests, and versioned Drizzle SQL/snapshots. Server-only imports prevent database code from entering public client bundles, and static web builds do not construct a database client.

## Schema

The schema contains ten operational tables:

- `merchants`
- `merchant_members`
- `merchant_environments`
- `merchant_settings`
- `merchant_api_keys`
- `payment_intents`
- `payment_intent_recipients`
- `chain_orders`
- `idempotency_keys`
- `audit_events`

Merchant/environment foreign keys, tenant-prefixed unique constraints, lifecycle enums, normalized EVM-address checks, deadline checks, and indexes are defined in `src/schema`. `merchant_api_keys` extends the A2 base as the M1.B2 persistence slice; its secret digest is non-recoverable and its list projection excludes the digest.

USDC amounts and chain IDs use PostgreSQL `numeric(78,0)` with Drizzle bigint mapping. `0.05 USDC` is stored as `50000`; floating point is not a canonical representation. Recipient validation requires 1–8 unique recipients totaling 10,000 BPS.

## Boundaries and transactions

`MerchantRepository`, `MerchantApiKeyRepository`, `PaymentIntentRepository`, `IdempotencyRepository`, and `AuditRepository` accept a tenant context where applicable. Payment Intent creation with recipients is intended to run with `withTransaction`, allowing M1.C to atomically persist intent, recipients, chain mapping, idempotency state, and audit evidence.

Repository lookups use merchant and environment together. External-order uniqueness and idempotency-key uniqueness are tenant-prefixed, while composite foreign keys ensure an environment belongs to the same merchant as each API key, payment intent, idempotency record, or tenant audit event. `withTransaction` exposes one Drizzle transaction executor to all participating repositories.

## Migration workflow

1. Run `pnpm --filter @settle/db config:check` and independently confirm both endpoints target the intended Neon project and non-production branch.
2. Generate versioned SQL with `pnpm --filter @settle/db db:generate`.
3. Read the complete SQL and reject unexpected `DROP` or destructive `ALTER` statements.
4. Run `git diff --check`.
5. Apply with `pnpm --filter @settle/db db:migrate`; this command uses only `DATABASE_MIGRATION_URL`.
6. Validate with `pnpm --filter @settle/db db:validate` and `pnpm --filter @settle/db test:integration`.

Production is not a migration target for these M1 slices. There is no fallback from the direct migration URL to the pooled runtime URL.

## Validation and deferred work

Development validation checks all ten tables, migration history, primary and foreign keys, indexes, integer base units, and rollback. Integration tests use isolated synthetic records inside transactions, prove rollback and tenant-scoped idempotency, and exercise the complete test API-key issue/authenticate/scope/revoke/audit lifecycle without leaving test rows behind.

WorkOS identity and secure sessions are implemented in M1.B1; merchant API-key persistence and service behavior are implemented in M1.B2. The public Payment Intent write API, persistent rate limiting, webhooks, reconciliation workers, full merchant dashboard, CCTP, and Arc mainnet support remain later slices. No contract behavior or canonical Arc settlement semantics changed here.
