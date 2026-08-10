# Settle Merchant API v1 Design

This is the target authenticated test-environment API. It is not implemented by
M1.A1. Existing public planning and read routes remain backward-compatible.

## Transport conventions

Base URL: `https://api.<settle-origin>/api/v1`; JSON; UTF-8; HTTPS only. Merchant
requests use `Authorization: Bearer sk_test_<secret>`. The secret is never accepted
in query parameters. Every mutating request requires a merchant-scoped
`Idempotency-Key` (1–255 printable characters, bounded by rate limits).

Responses include `request_id`. Errors use:

```json
{"error":{"type":"invalid_request_error","code":"invalid_amount","message":"amount must be a six-decimal USDC string","param":"amount"},"request_id":"req_..."}
```

Use `400` invalid input, `401` missing/invalid key, `403` inactive merchant/scope,
`404` hidden cross-tenant resource, `409` idempotency conflict or invalid state,
`422` semantically unsupported request, `429` rate limit, and `5xx` for transient
platform failure. Do not reveal whether another merchant owns an ID.

## Payment Intent resource

```json
{
  "id":"pi_test_01J...",
  "environment":"test",
  "external_order_id":"order-928310",
  "amount":{"currency":"USDC","base_units":"42500000","value":"42.50"},
  "buyer":"0x1111111111111111111111111111111111111111",
  "settlement_recipients":[{"address":"0x222...222","share_bps":9000}],
  "funding_deadline":"2030-01-01T12:00:00Z",
  "settlement_deadline":"2030-01-08T12:00:00Z",
  "order_id":"0x...",
  "terms_hash":"0x...",
  "checkout_url":"https://pay.settle.test/pay/0x...",
  "application_state":"awaiting_payment",
  "canonical":{"status":"Created","observed_at":"2030-...","block_number":"123"},
  "operations":{"activation":"succeeded","settlement":"not_started"},
  "created_at":"2030-...","updated_at":"2030-..."
}
```

`canonical` is null before activation and may be `reconciliation_issue` when unavailable.
`checkout_url` is returned only when a canonical order exists; planned intents are
not payable. IDs are opaque and merchant-scoped. Amounts are exact six-decimal USDC.

## Endpoints

### `POST /api/v1/payment-intents`

Scope: `payment_intents:write`. Body:

```json
{"external_order_id":"order-928310","buyer":"0x...","amount":"42.50","currency":"USDC","funding_deadline":"2030-01-01T12:00:00Z","settlement_deadline":"2030-01-08T12:00:00Z","settlement_recipients":[{"address":"0x...","share_bps":10000}],"metadata":{"cart":"optional-bounded-value"}}
```

Validate strict fields, normalize addresses, derive `order_id` and `terms_hash` with
the existing shared canonical algorithm, and persist the intent. A retry with the
same key and identical fingerprint returns the original `201` result. Same key with a
different fingerprint returns `409 idempotency_key_reused`. Same external order ID
with different terms returns `409 external_order_id_conflict`.

### `GET /api/v1/payment-intents/:id`

Scope: `payment_intents:read`. Returns the merchant projection plus a fresh canonical
read where available. Database state never overwrites the chain status.

### `GET /api/v1/payment-intents`

Scope: `payment_intents:read`. Query: `limit` (1–100, default 25), opaque `starting_after`,
`ending_before`, `status`, `external_order_id`, and `created[gte|lte]`. Sort by
`created_at DESC, id DESC`. Return `{data,has_more,next_cursor,request_id}`. Filters
are merchant/environment scoped.

### `POST /api/v1/payment-intents/:id/activate`

Scope: `payment_intents:write`. No buyer or transaction data is accepted. The endpoint
validates merchant state, deadlines, immutable intent data, and duplicate activation,
then creates/claims a controlled activation operation. It may return `202` with
`activation: queued` or `200` only after canonical `OrderCreated` is independently
verified. It never accepts `execute`, calldata, wallet IDs, Circle IDs, role claims, or
caller-selected Circle idempotency keys, and never exposes privileged settlement
execution. Activation is not automatic settlement.

### API key management

- `POST /api/v1/api-keys` — dashboard session or owner scope; body `name`, `environment`,
  `scopes`, optional expiry. Returns secret once plus `id`, `key_id`, `prefix`.
- `GET /api/v1/api-keys` — returns metadata only.
- `POST /api/v1/api-keys/:id/rotate` — creates replacement, returns new secret once;
  old key remains valid only during an explicit short overlap window.
- `POST /api/v1/api-keys/:id/revoke` — immediate revocation; idempotent.

API key management should normally use the authenticated dashboard session rather than
an API key, and requires owner/admin authorization.

### Webhook management

- `POST /api/v1/webhook-endpoints`: create HTTPS endpoint and subscriptions; returns
  secret once.
- `GET /api/v1/webhook-endpoints`: list metadata.
- `PATCH /api/v1/webhook-endpoints/:id`: update URL/subscriptions/status.
- `POST /api/v1/webhook-endpoints/:id/rotate-secret`: return new secret once.
- `POST /api/v1/webhook-endpoints/:id/test`: enqueue a signed test event.
- `GET /api/v1/webhook-endpoints/:id/deliveries`: cursor-paginated logs.
- `POST /api/v1/webhook-deliveries/:id/retry`: owner/admin action; enqueue once.

## Events

Initial event types: `payment_intent.created`, `payment_intent.activated`,
`payment_intent.payment_window_expired`, `payment_intent.funded`,
`payment_intent.disputed`, `payment_intent.completed`, `payment_intent.refunded`,
`payment_intent.cancelled`, `payment_intent.reconciliation_issue`, and
`payment_intent.webhook_delivery_failed`. Events contain `id`, `type`, `version`,
`created`, `environment`, and a resource snapshot. Delivery is at-least-once; merchants
deduplicate by event ID and must tolerate ordering gaps. The event timestamp is not
proof of chain finality; canonical fields include observed block/transaction evidence.

## Compatibility and release boundary

Keep `POST /api/v1/orders/plan` public, strict, and non-mutating. Keep current public
GET reads and hosted checkout during migration. Do not alias merchant IDs to `orderId`.
Test keys can create only test-environment resources and test checkout URLs; live keys
are rejected until a separate live-mode approval. No endpoint performs CCTP or exposes
Circle credentials/public operator execution in M1.
