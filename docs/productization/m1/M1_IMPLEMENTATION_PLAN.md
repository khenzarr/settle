# Settle M1 Implementation Plan

This sequence begins after M1.A1 approval. It does not modify the deployed escrow or
introduce CCTP. All slices are test-environment first.

## Current implementation checkpoint

- M1.A2 persistence/data foundation: implemented and validated against the configured Neon target.
- M1.B1 merchant identity and secure sessions: implemented; manual hosted-login staging checkpoint remains.
- M1.B2 merchant API-key service: persistence, issue/list/authenticate/revoke, scopes, expiry, and audit implemented; management UI remains in the dashboard slice.
- M1.C Payment Intent API: create/list/detail/queued activation, atomic idempotency, persistent rate limiting, request envelopes, migration, and Neon concurrency validation implemented.
- M1.D onward: not yet implemented.

## M1.A2 — persistence/data foundation

**Goal:** provision managed PostgreSQL, Drizzle schema/migrations, repository interfaces,
transaction helpers, encrypted secret abstraction, and request/audit IDs.

**Likely areas:** `apps/web/lib/db`, `apps/web/lib/repositories`, `packages/shared` pure
schemas, new worker package/entrypoint, deployment secret docs. **Dependencies:** provider
selection, connection pooling, migration ownership. **Tests:** migration smoke, unique
constraints, transaction rollback, tenant predicates, leases/version CAS, test DB.
**Acceptance:** clean bootstrap, repeatable migrations, no secrets committed, durable
store passes multi-instance/concurrency tests. **Risks:** serverless connection limits,
provider lock-in, accidental PII/secret persistence.

## M1.B — merchant auth + API keys

**Goal:** merchant onboarding/status, test environment, managed session adapter, membership
authorization, key create/list/revoke/rotate, scope checks and rate limits.

**Likely areas:** `apps/web/app/(merchant)`, auth adapter, API-key service, middleware,
repositories. **Dependencies:** A2 and provider callback/origin setup. **Tests:** auth
expiry/CSRF, role/status matrix, hash verification, one-time display, enumeration and
cross-tenant tests. **Acceptance:** owner can create a test key; inactive tenants and
wrong scopes fail closed. **Risks:** provider misconfiguration and accidental public
bundle exposure.

## M1.C — Payment Intent API + idempotency

**Goal:** persist merchant Payment Intents, preserve deterministic order/terms derivation,
support create/list/detail/activate, safe retries, conflicts, and checkout URL creation
only after canonical activation.

**Likely areas:** `apps/web/app/api/v1/payment-intents`, application services, shared
merchant schemas, idempotency repository. **Dependencies:** A2/B; controlled activation
adapter and existing canonical reader. **Tests:** exact money/splits/deadlines,
fingerprint equality/conflict, concurrent retries, resource isolation, canonical mapping.
**Acceptance:** a test merchant can create an intent and receive stable metadata; no
public execute/calldata/Circle controls. **Risks:** external-order collision, ambiguous
activation, confusing planned versus payable states.

## M1.D — webhook/event delivery

**Goal:** create immutable domain events from verified lifecycle transitions, sign payloads,
deliver at least once with retries/backoff, logs, replay, and endpoint/key rotation.

**Likely areas:** webhook services/routes, worker delivery handler, event schemas.
**Dependencies:** A2/C and canonical event policy. **Tests:** HMAC raw-body fixtures,
timestamp/replay, duplicate delivery, ordering gaps, timeout/429/5xx backoff, SSRF and
manual retry authorization. **Acceptance:** merchant receives verified `funded` and final
events with inspectable delivery state. **Risks:** event duplication/order assumptions,
SSRF, retry storms.

## M1.E — reconciliation worker

**Goal:** scan escrow logs from a durable cursor, normalize observations, verify complete
canonical order state, project statuses, correlate Circle IDs/hashes, and surface divergence.

**Likely areas:** worker chain adapter, reconciliation repositories, shared event/read
utilities, operator evidence service. **Dependencies:** A2/C; RPC provider and deployment
block. **Tests:** cursor crash/restart, duplicate logs, RPC retry, reorg/hash mismatch,
malformed ABI, missing events, Circle ambiguity, canonical-versus-DB disagreement.
**Acceptance:** canonical chain wins every disagreement; worker is resumable and alerts
without inventing transitions. **Risks:** RPC limits/reorgs, stale indexes, false finality.

## M1.F — merchant dashboard + functional UX

**Goal:** deliver sign-in/onboarding, test-mode shell, payments list/detail, canonical
status/splits/evidence, API keys, webhook configuration/delivery logs, and safe retry/
replay actions.

**Likely areas:** new merchant pages/components, server loaders/actions, responsive/accessibility
tests. **Dependencies:** B–E. **Tests:** route authorization, loading/degraded states,
pagination, status projection, no secret rendering, Playwright smoke. **Acceptance:**
merchant can operate a complete test payment lifecycle without visual redesign scope
creep. **Risks:** presenting stale application data as final, unsafe operational buttons.

## M1.G — end-to-end/security/reliability gate

**Goal:** prove the complete testnet product path and operational readiness.

**Likely areas:** integration/e2e suites, worker runbook, deployment/observability,
security checks. **Dependencies:** all prior slices and approved testnet accounts.
**Tests:** create -> activate -> checkout -> buyer fund -> canonical funded -> webhook ->
reconciliation -> controlled settlement evidence -> final webhook; restart/failure,
rate-limit, tenant isolation, secret scan, migrations, backup/restore, lint/typecheck/
build and Foundry regression. **Acceptance:** no contract changes, no public privileged
execution, canonical state and webhook audit agree, alerts/runbooks tested. **Risks:**
testnet volatility, provider outage, unresolved reconciliation or Circle ambiguity.

## Cross-slice release rules

Each slice ships behind test-mode configuration and preserves existing public planning,
checkout, and grant artifacts. Do not collapse application, chain, and transport enums.
Do not add automatic settlement: an authorized operational policy must explicitly decide
when a funded order is released/refunded, and any controlled mutation requires a later
security review. Do not begin M2 CCTP work until M1.G passes.

## Required approval decisions before A2

1. Select managed Postgres provider and confirm data residency/retention.
2. Approve Drizzle and migration ownership in the monorepo.
3. Select OIDC/session provider and production/preview origin policy.
4. Approve worker hosting/scheduling and RPC provider/SLA.
5. Confirm whether M1 activation is queued for separately authorized operator execution
   or remains an explicit internal operation until that gate is approved.
