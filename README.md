# Settle

Settle is API-first USDC payment and marketplace-settlement infrastructure built on Arc. The current test-mode foundation combines deterministic settlement contracts, Circle-controlled operations, a buyer checkout experience, merchant identity and onboarding, tenant-safe PostgreSQL persistence, revocable merchant API keys, an idempotent Payment Intent API, and signed at-least-once merchant webhooks.

## Repository

- `apps/web`: Next.js public demo, buyer checkout, WorkOS sign-in, onboarding, and merchant shell
- `packages/contracts`: Foundry settlement contracts and Solidity tests
- `packages/circle`: Circle wallet/contract operator tooling and integrity checks
- `packages/db`: Drizzle schema, migrations, tenant-aware repositories, identity persistence, API-key lifecycle, Payment Intents, distributed rate limits, and webhook delivery workers
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

Create a test Payment Intent with the issued write-scoped key:

```sh
curl -X POST http://localhost:3000/api/v1/payment-intents \
  -H "Authorization: Bearer $SETTLE_TEST_API_KEY" \
  -H "Idempotency-Key: cart-928310-create-v1" \
  -H "Content-Type: application/json" \
  -d '{"external_order_id":"order-928310","buyer":"0x1111111111111111111111111111111111111111","amount":"42.50","currency":"USDC","funding_deadline":"2030-01-01T12:00:00Z","settlement_deadline":"2030-01-08T12:00:00Z","settlement_recipients":[{"address":"0x2222222222222222222222222222222222222222","share_bps":10000}],"metadata":{"cart":"928310"}}'
```

The response is stable across identical retries. Planned or queued intents return
`checkout_url: null`; no payment link is emitted until canonical activation is independently verified.

## Signed webhooks

Generate a dedicated 32-byte encryption key and set its base64 output as
`SETTLE_WEBHOOK_ENCRYPTION_KEY_V1`. This key encrypts endpoint-specific signing secrets;
it is not the signing secret sent to merchants.

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Create an HTTPS endpoint with a `webhook_endpoints:write` test key. The signing secret
is returned only on the first successful request; idempotent replays return `secret: null`.

```sh
curl -X POST http://localhost:3000/api/v1/webhook-endpoints \
  -H "Authorization: Bearer $SETTLE_TEST_API_KEY" \
  -H "Idempotency-Key: webhook-create-v1" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://merchant.example/webhooks/settle","description":"Test events","subscriptions":["payment_intent.created","payment_intent.funded"]}'
```

Run one bounded worker batch from a protected scheduler or worker runtime:

```sh
pnpm --filter @settle/db webhooks:work -- --limit=10
```

Deliveries sign the exact canonical UTF-8 body with `Settle-Signature:
t=<unix>,v1=<hex>` and include `Settle-Event-Id`. The worker rejects non-HTTPS,
private, loopback, link-local, internal, redirected, oversized-response, and unsafe DNS
destinations. Automatic retries are limited to timeouts, network failures, `408`, `429`,
and `5xx` responses.

`payment_intent.created` is emitted atomically in this slice. Canonical funded and final
events are supported by the event layer but will only be emitted after M1.E independently
verifies the Arc lifecycle; M1.D does not fabricate chain transitions.

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
