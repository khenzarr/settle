# Settle M1 Architecture Baseline

**Status:** architecture and discovery only  
**Revision audited:** `4bab7eed6ec9fc1fc9b3ae839e86c53f14097777`  
**Network:** Arc Testnet (`5042002`)  
**Scope:** merchant productization before mainnet; no runtime implementation in M1.A1

## 1. Decision summary

Settle should evolve into a stateless Next.js API/web application backed by managed
PostgreSQL and a separately run durable worker. The web tier owns request validation,
merchant authorization, projections, and dashboard rendering. The worker owns retries,
webhook delivery, RPC event ingestion, reconciliation, and bounded operational work.
Neither tier may treat an application row as proof that an escrow transition occurred.

The deployed `SettlementEscrow` at
`0x3e438ae878a8dc02c83f5545047cbde33a4f795f` remains the only settlement contract in
scope. No contract deployment, CCTP, automatic settlement policy, or public privileged
execution is part of M1.A1.

## 2. Current repository audit

### Structure

| Area | Current responsibility |
|---|---|
| `apps/web` | Next.js 16 App Router public site, docs/demo, hosted checkout, route handlers, server-only services, buyer wallet client flow |
| `packages/shared` | Arc metadata, exact six-decimal USDC, schemas, deterministic order/terms identity, escrow ABI, read projections, event decoding, evidence, command plans |
| `packages/circle` | Node-only Circle Developer-Controlled Wallets/Contracts client boundary, configuration, redaction, wallet reads, guarded mutation preparation, operator plans |
| `packages/contracts` | Foundry `SettlementEscrow`, ABI source/tests/scripts; deployed contract is immutable for this phase |
| `docs` | Architecture, deployment, integration, security, design, and grant evidence/runbooks |

There is no ORM, database provider, migration directory, durable queue, worker,
merchant authentication/session implementation, merchant API-key store, webhook
endpoint/event/delivery infrastructure, or merchant dashboard.

### Existing routes and pages

Current pages are `/`, `/demo`, `/docs`, and `/pay/[orderId]`. Current API routes are:

- `POST /api/v1/orders/plan`: deterministic, strict, non-mutating planning.
- `GET /api/v1/orders/:orderId`: canonical order projection and bounded evidence.
- `GET /api/v1/payment-intents/:orderId`: onchain Payment Intent projection.
- `GET /api/v1/payment-intents/:orderId/handoff`: checkout handoff payload.
- `POST /api/buyer/order`: canonical buyer/order read and allowance data.
- `POST /api/buyer/order/evidence`: buyer evidence read.
- `POST /api/buyer/transaction/confirm`: receipt plus canonical-state confirmation.
- `POST /api/operator/order/action/plan`: server-side operator dry-run planning.

Public routes are not merchant-authenticated. No current route creates a persistent
Payment Intent or exposes privileged execution.

### Domain and lifecycle findings

`packages/shared/src/marketplace.ts` accepts printable `externalOrderId`, buyer,
amount, deadlines, and up to eight unique recipients whose BPS sum is exactly 10,000.
It normalizes values and derives:

```text
orderId  = keccak256(canonicalSettlementFields("settle.marketplace.order-id.v1", fields))
termsHash = keccak256(canonicalSettlementFields("settle.marketplace.terms.v1", fields))
```

The fields include normalized buyer, exact USDC base units, deadlines, and normalized
recipient/BPS pairs. `externalOrderId` is included in both hashes but is not stored by
the contract. A merchant database must therefore preserve the external reference and
the exact request fingerprint alongside the derived values.

The contract states are `None`, `Created`, `Funded`, `Disputed`, `Completed`,
`Refunded`, and `Cancelled`. The current projection adds `planned`,
`awaiting-payment`, and `payment-window-expired`; expiry presentation does not mutate
the chain. Buyer approval/funding is browser-wallet controlled, exact, and confirmed
only by a subsequent canonical read. Release/refund planning is server-only and
execution-disabled in the current deployment.

### Chain, Circle, and configuration boundaries

`settlement-read.ts` performs chain-ID checks, typed ABI reads, receipt reads, and
strict malformed-response handling. `settlement-events.ts` decodes all escrow lifecycle
events, including log position and transaction hash. Evidence reads currently use RPC
logs from the configured deployment block; there is no durable cursor.

`packages/circle` lazily constructs Node-only clients from `CIRCLE_API_KEY` and
`CIRCLE_ENTITY_SECRET`, redacts credentials, validates wallet/network/address ownership,
and supports explicit dry-run versus mutation gates. The web operator security module
already defines fail-closed authorization, exact-origin checks, server-generated
execution idempotency, ambiguous recovery states, and a durable-store interface; its
in-memory store is test/design-only.

Configuration is environment-based. Public chain metadata may use `NEXT_PUBLIC_*`;
Circle credentials, database credentials, auth secrets, execution flags, role
configuration, and worker credentials must remain server-only. The repository has no
Dockerfile, Vercel manifest, or proven production provider. It is compatible with a
stateless Vercel/Next deployment, but deployment selection remains an operational
decision.

## 3. Target logical architecture

```text
Merchant SDK/server --API key--> Next route handlers
                                      |
                            application services/repositories
                                      |
                 managed PostgreSQL <----> durable worker
                                      |              |
                              merchant dashboard   Arc RPC / Circle status
                                      |
                         signed webhook delivery --> merchant endpoint

Buyer browser --wallet signature/tx--> Arc USDC + SettlementEscrow
```

Recommended package boundaries:

- `packages/shared`: retain pure money, identity, contract, projection, and event
  primitives; add merchant API schemas only when implementation begins.
- `apps/web/lib/application`: merchant, intent, idempotency, and webhook use cases;
  no provider SDK imports.
- `apps/web/lib/auth.server.ts`: provider adapter and merchant membership lookup.
- `apps/web/lib/db`: Drizzle schema, migrations, repositories, and transactions.
- `apps/web/lib/chain`: RPC adapter and reconciliation services; reuse shared readers.
- `apps/worker` (or a worker entrypoint package): claimable jobs, reconciliation, and
  webhook delivery. It must not expose an HTTP merchant surface.
- `packages/circle`: preserve the server-only Circle gateway and record references,
  never credentials or raw responses.

## 4. Authority hierarchy

1. **Arc/SettlementEscrow** is canonical for order existence, buyer, amount, deadlines,
   terms hash, recipients, BPS, and escrow lifecycle status/timestamps.
2. **Database** is authoritative only for merchant/application ownership, external
   references, API configuration, webhook configuration, request idempotency, job
   progress, and audit records. It is an operational projection of chain facts.
3. **Circle** is evidence for a controlled wallet operation and its provider status;
   it is not settlement truth. Final transaction and contract state must be checked on
   Arc.

On disagreement, keep the raw observation, mark reconciliation issue, stop unsafe
follow-on operation, and emit an internal alert. Re-read the canonical contract with
bounded RPC retry and compare immutable fields. Never “repair” chain truth from the
database, silently mark a payment completed from Circle `COMPLETE`, or delete the
conflicting observation. Merchant responses show `reconciliation_issue` where the
canonical state cannot safely be projected.

## 5. Three independent state planes

### Application Payment Intent

Exact enum: `planned`, `awaiting_activation`, `awaiting_payment`,
`payment_window_expired`, `funded`, `disputed`, `completed`, `refunded`, `cancelled`.
Creation starts at `planned`; explicit activation request moves to
`awaiting_activation`; verified `Created` moves to `awaiting_payment`; deadline expiry
moves only the application projection to `payment_window_expired`; verified `Funded`
moves to `funded`; verified `Disputed` moves to `disputed`; verified terminal contract
states move to their matching terminal state. Activation rejection may return to
`planned`; an ambiguous activation remains `awaiting_activation` with operation state
`ambiguous`. No transition skips canonical verification. `cancelled` means an unfunded
canonical cancellation, never a refund.

### Onchain escrow

Mirror the exact contract enum: `none`, `created`, `funded`, `disputed`, `completed`,
`refunded`, `cancelled`. The database stores the last observed value, block, log, and
read time; only a verified chain read drives the canonical projection.

### Transport/operation

Operation enum: `not_started`, `queued`, `running`, `submitted`,
`confirmation_pending`, `succeeded`, `failed`, `ambiguous`, `manual_review`; webhook
delivery enum: `pending`, `delivering`, `delivered`, `retrying`, `exhausted`,
`dead_letter`; reconciliation enum: `unverified`, `in_sync`, `retrying`, `diverged`,
`manual_review`. “Operator action pending” is represented by an operation in `queued`,
`running`, `submitted`, or `confirmation_pending`, not by changing payment state. A
reconciliation issue is `diverged` or `manual_review`, not a fabricated contract state.
No state plane implies an automatic settlement decision.

## 6. Product surfaces and non-goals

M1 functional UX: sign-in/onboarding, test-mode selector, dashboard payments list,
payment detail with canonical status and split breakdown, API keys, webhook endpoints
and delivery logs, safe replay/retry controls, and existing hosted checkout/docs.
M3 may optimize visual design, analytics, bulk operations, richer roles, and enterprise
UX. M1 does not add CCTP, new contracts, live/mainnet mode, automatic settlement,
merchant custody, or arbitrary contract execution.

## 7. Technology decisions

- Managed serverless PostgreSQL; provider may be Neon, Supabase, or equivalent after
  operational review. Prefer one database over separate KV/Redis initially.
- Drizzle ORM with SQL migrations and repository interfaces. It is transparent and
  fits the existing TypeScript workspace; services must not depend on Drizzle types.
- Managed OIDC-compatible auth/session provider behind an adapter, secure HttpOnly
  cookies, server-side merchant membership and status checks.
- API secrets: cryptographically random 32-byte secret, displayed once; store a
  non-secret key identifier/prefix and HMAC-SHA-256 digest using a separately managed
  server pepper, with merchant/environment/scope/revocation metadata. A password KDF
  is unnecessary for a uniformly random 256-bit secret and increases authentication
  denial-of-service exposure.
- Worker: Node process scheduled continuously or by protected cron; Postgres claim
  rows with leases. Webhook delivery is at-least-once; no Redis until measured need.
- Next/Vercel web/API plus managed Postgres plus protected worker runtime. All state
  survives instance replacement; Circle credentials exist only in the worker/API
  secret manager.

## 8. M1 acceptance boundary

M1 is ready only when a test merchant can create an intent with an API key, receive a
stable checkout URL, observe buyer funding from canonical chain state, receive signed
at-least-once lifecycle events, inspect the payment in the dashboard, and reconcile a
Circle operation reference without any public privileged execution path. All testnet
flows remain explicitly test-mode and all disagreement paths are visible.
