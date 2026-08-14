# M1.B2 Merchant API keys

## Scope

M1.B2 adds the server-only API-key foundation required by the Payment Intent API while preserving the M1.B1 WorkOS identity/session flow. Human sessions and machine credentials remain separate authority channels. This slice changes no settlement contract behavior and exposes no public privileged execution.

Implemented capabilities:

- create, list, authenticate, and revoke test-mode merchant keys;
- `payment_intents:read` and `payment_intents:write` scopes;
- merchant/environment isolation and active-status enforcement;
- optional expiry, last-used evidence, and immediate revocation;
- one-time plaintext display with no recoverable database copy;
- audited creation and revocation;
- a controlled local test-merchant/bootstrap command.

The public `/api/v1/payment-intents` route, dashboard key-management UI, persistent/distributed rate limiting, key rotation UX, and live-mode keys are intentionally outside this slice. M1.C will consume the authentication service at its API boundary.

## Credential format and storage

Test keys use this structured form:

```text
sk_test_<22-character key id>_<43-character secret>
```

Both components come from cryptographically secure random bytes. The full plaintext is returned only by the issuance operation. PostgreSQL stores a safe display prefix and a versioned HMAC-SHA256 digest produced with `SETTLE_API_KEY_PEPPER_V1`; it never stores the raw secret. The pepper must contain at least 32 bytes and remains outside source control.

Authentication strictly accepts one `Authorization: Bearer <key>` value. The key ID selects a candidate record, then digest comparison uses constant-time verification. Malformed and unknown credentials take a dummy-HMAC path and return the same `invalid_api_key` response as altered, expired, revoked, inactive, or wrong-environment credentials. Valid credentials without the required scope return `insufficient_scope`.

## Persistence and tenant boundaries

`merchant_api_keys` is anchored to the composite merchant/environment boundary. The global key ID is unique for lookup, while merchant/environment constraints and repository predicates protect lifecycle operations. The creator membership, when present, must belong to the same merchant. Database checks constrain key/digest formats, scope JSON, lifecycle timestamps, and digest version.

List results omit both plaintext and digest. Revocation uses tenant predicates and becomes effective before a subsequent authentication can update `last_used_at`. Creation and revocation append `merchant.api_key.created` and `merchant.api_key.revoked` audit records.

## Operations

Required environment variables:

```text
DATABASE_URL
DATABASE_MIGRATION_URL
SETTLE_API_KEY_PEPPER_V1
```

Configuration requires a pooled Neon runtime URL and direct Neon migration URL with TLS. Both URLs must resolve to the same endpoint, role, and database.

Apply and validate:

```sh
pnpm --filter @settle/db config:check
pnpm --filter @settle/db db:migrate
pnpm --filter @settle/db db:validate
pnpm --filter @settle/db test:integration
```

Create or reuse a test merchant and issue a 90-day key:

```sh
pnpm --filter @settle/db merchant:bootstrap:test -- --name "Example Merchant" --slug example-merchant
```

The output contains the only recoverable copy of the plaintext key. Store it in the intended secret manager and revoke it when no longer needed.

## Verification evidence

The migration was applied to the explicitly supplied Neon target and then reapplied as an idempotency check. Schema validation confirms ten tables, ten primary keys, fourteen foreign keys, thirty-nine indexes, integer USDC base-unit storage, and transaction rollback.

The real-database integration test executes inside a rollback-only transaction and proves issuance, non-storage of plaintext, successful authentication, last-used tracking, safe listing, insufficient-scope rejection, altered-key rejection, cross-tenant revoke denial, immediate revocation, post-revocation rejection, and both audit events. No synthetic lifecycle row remains after the test.

## Next security gates

M1.C should add a single API middleware that maps the required scope to each route, a persistent/distributed per-key and per-merchant rate limiter, request IDs, idempotency enforcement, bounded request bodies, and uniform error envelopes. The dashboard management UI must require an authorized WorkOS merchant membership, apply CSRF-safe server actions, and never re-render a stored secret. Live keys, pepper rotation procedures, production migrations, and production incident runbooks require a separate readiness review.
