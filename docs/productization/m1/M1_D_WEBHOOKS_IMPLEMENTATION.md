# M1.D Webhook events and at-least-once delivery

## Scope

M1.D adds tenant-scoped webhook endpoint management, immutable merchant event envelopes,
durable delivery state, signed network attempts, bounded automatic retries, inspectable
attempt history, secret rotation, and audited manual retry controls.

Implemented test-mode routes:

- `POST /api/v1/webhook-endpoints`
- `GET /api/v1/webhook-endpoints`
- `PATCH /api/v1/webhook-endpoints/:id`
- `POST /api/v1/webhook-endpoints/:id/rotate-secret`
- `POST /api/v1/webhook-endpoints/:id/test`
- `GET /api/v1/webhook-endpoints/:id/deliveries`
- `POST /api/v1/webhook-deliveries/:id/retry`

Endpoint routes require the new `webhook_endpoints:read` or
`webhook_endpoints:write` test-key scopes. Mutations require bounded idempotency keys.
Cross-tenant endpoint and delivery IDs return uniform not-found responses.

## Secret boundary and signing

Each endpoint receives a cryptographically random `whsec_` signing secret. The plaintext
is returned only by the first successful creation or rotation response. Idempotent replay
returns safe metadata with `secret: null`. PostgreSQL stores authenticated AES-256-GCM
ciphertext only. The versioned encryption key is loaded from
`SETTLE_WEBHOOK_ENCRYPTION_KEY_V1` and must decode to exactly 32 bytes.

The worker canonicalizes the stored event envelope, verifies its SHA-256 payload hash,
and signs `<unix_timestamp>.<exact_raw_body>` with HMAC-SHA256. Requests include:

```text
Settle-Signature: t=<unix>,v1=<lowercase hex>
Settle-Event-Id: <immutable event UUID>
```

Retries preserve the event ID and payload. A new timestamp and signature are generated
for each attempt. Merchant receivers must enforce timestamp tolerance, use constant-time
signature verification, and deduplicate by event ID.

## Persistence and concurrency

Migration `0003_m1_d_webhooks.sql` adds:

- `webhook_endpoints`
- `webhook_events`
- `webhook_deliveries`
- `webhook_delivery_attempts`

Semantic event uniqueness prevents duplicate lifecycle events. Endpoint delivery rows
are unique per event and endpoint. Workers claim due rows with `FOR UPDATE SKIP LOCKED`,
bounded leases, and immutable attempt numbers. Endpoint disablement dead-letters
claimable work rather than deleting history.

Payment Intent creation and its `payment_intent.created` event/delivery fan-out share
one database transaction. The event service also accepts canonical funded, disputed,
completed, refunded, cancelled, expiry, and reconciliation events, but those types are
not emitted until M1.E supplies independently verified Arc observations.

## Delivery policy

Success is any `2xx` response. Network/DNS timeouts, `408`, `429`, and `5xx` responses
retry with deterministic exponential backoff and bounded jitter. Other `3xx`/`4xx`
responses are terminal. Automatic delivery exhausts after eight attempts; manual retry
is separately rate-limited, idempotent, tenant-scoped, and audited.

The worker validates every destination immediately before connection, permits HTTPS on
port 443 only, rejects credentials/fragments, resolves all A/AAAA answers, rejects the
entire destination if any answer is private/loopback/link-local/reserved, pins the
approved IP into the TLS connection, preserves hostname verification/SNI, follows no
redirects, uses a five-second timeout, caps response bytes, and forwards no merchant or
Circle credentials.

## Worker deployment boundary

`pnpm --filter @settle/db webhooks:work -- --limit=10` processes one bounded batch. No
public worker or privileged execution route is introduced. A protected scheduler or
continuous worker host must be selected and configured before production operation.

## Verification

The M1.D gates cover encryption/non-recovery, HMAC raw-body fixtures, timestamp replay,
URL/IP rejection, response classification, bounded deterministic backoff, endpoint
idempotency, tenant isolation, atomic event fan-out, `500` retry, `204` success, payload
stability, signature verification, attempt history, migration validation, typecheck,
production build, and the existing contract/Circle regression suite.

## Explicit boundaries

M1.D sends no Arc transaction, performs no Circle operation, exposes no operator action,
does not perform CCTP, and does not infer funded or terminal payment state. M1.E remains
responsible for canonical Arc reconciliation and for emitting verified lifecycle events.
