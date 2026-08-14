# M1.C Payment Intent API and idempotency

## Scope

M1.C adds the authenticated test-mode merchant Payment Intent API on top of the M1.A2
persistence layer and M1.B2 API-key boundary. It preserves the existing public
bytes32 `orderId` read route and introduces merchant UUID detail reads without aliasing
the two identifiers.

Implemented capabilities:

- strict, bounded `POST /api/v1/payment-intents` creation using the existing shared
  deterministic `orderId` and `termsHash` algorithm;
- atomic intent, recipient, audit, and idempotency-result persistence;
- identical retry replay and concurrent retry convergence;
- fingerprint and external-order conflict detection;
- tenant-scoped list/detail reads with bounded filters and opaque cursors;
- persistent per-key, per-merchant, and trusted-IP rate-limit buckets;
- uniform request IDs and API error envelopes;
- `POST /api/v1/payment-intents/:id/activate`, which only queues a controlled operator
  record and accepts no execution, calldata, wallet, Circle, or transaction fields;
- checkout URL suppression until a canonical order is independently verified.

M1.C does not submit an Arc transaction, execute a Circle operation, perform CCTP, or
settle an order. The queued activation record is the durable handoff for the separately
authorized operator/reconciliation slices.

## Security and consistency behavior

Merchant requests require a test API key with the route's `payment_intents:read` or
`payment_intents:write` scope. Request bodies are JSON-only and capped at 32 KiB.
Metadata is flat, contains at most 20 bounded keys, and is capped at 4 KiB. Funding and
settlement deadlines are future-bounded. Amounts are parsed as exact USDC base units;
recipients are normalized and must total 10,000 basis points.

Every mutation requires a printable 1–255 byte `Idempotency-Key`. The database stores
only its SHA-256 digest and a canonical request fingerprint. The claim, resource write,
bounded response snapshot, and audit record share one transaction. The unique tenant
key serializes concurrent retries; identical requests replay the original status and
body, while a changed fingerprint fails with `409 idempotency_key_reused`.

Rate limiting uses atomic PostgreSQL upserts with a conditional increment. Authenticated
requests consume per-key and per-merchant buckets; requests with a trusted Vercel source
address also consume a privacy-preserving IP digest bucket. Limits are route-specific.

## Activation boundary

Activation validates tenant ownership, the funding window, immutable intent state, and
idempotency. It creates at most one `operator_executions` row for `(intent, activation)`,
sets the application state to `awaiting_activation`, and returns `202`. The endpoint
does not call Circle or Arc. `checkout_url` remains `null` while canonical status is
`none`; only later independent verification may populate the checkout path.

## Migration and verification evidence

Migration `0002_m1_c_payment_intents.sql` adds `operator_executions`,
`api_rate_limit_buckets`, and their constrained enums/indexes. It was applied to the
configured Neon development target. Validation reports three migrations, twelve tables,
twelve primary keys, twenty foreign keys, forty-seven indexes, exact integer base-unit
storage, and transaction rollback.

The real-database integration test proves concurrent create convergence, stable replay,
fingerprint conflict, external-order conflict, tenant-hidden detail access, list access,
single queued activation, absent pre-canonical checkout URL, and the persistent rate
limit boundary. Synthetic test rows are removed in `finally` cleanup.

Run the complete M1.C checks with:

```sh
pnpm --filter @settle/shared test
pnpm --filter @settle/db typecheck
pnpm --filter @settle/db test
pnpm --filter @settle/db db:migrate
pnpm --filter @settle/db db:validate
pnpm --filter @settle/db test:integration
pnpm --filter @settle/web test
pnpm --filter @settle/web typecheck
pnpm --filter @settle/web build
```

## Next slice

M1.D consumes verified lifecycle transitions to create immutable merchant events and
signed at-least-once webhook deliveries. The activation worker and canonical
reconciliation behavior remain subject to the separate operator authorization gate;
no public privileged execution route should be introduced.
