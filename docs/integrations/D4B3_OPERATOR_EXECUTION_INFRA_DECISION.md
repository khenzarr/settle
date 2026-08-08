# D4B3B3A Operator Execution Infrastructure Decision

## Decision status

This is an architecture and infrastructure decision only. It adds no authentication,
database, provider account, production secret, execute route, Circle mutation, or
deployment configuration. Operator execution remains disabled.

**Recommendation:** when execution is eventually required, use a managed,
Next-compatible authentication/session provider behind `OperatorAuthorizationGateway`
and a managed serverless Postgres database behind `OperatorExecutionStore`. Use an
exact configured production origin and an explicit, false-by-default execution flag.
For the grant/demo, choose **Path B**: keep product-level execution disabled and
present the independently proven lifecycle together with the server-only dry-run
boundary.

## 1. Current safety baseline

D4B3B1 established server-only create-order and release-order planning. D4B3B2 added
fail-closed authorization, trusted request provenance, an application operator
principal, server-owned idempotency, duplicate suppression, ambiguous-outcome
recovery, the durable-store interface, and a public status projection. There is no
execute route, no Circle mutation import in the web operator path, and no browser
Circle access.

`InMemoryOperatorExecutionStore` is explicitly non-durable and must remain limited to
tests/design work. The current capability check rejects it for production.

## 2. Requirements and deployment findings

The store must coordinate multiple requests and instances, survive process restarts,
and preserve one logical `(operation, orderId)` execution attempt through an
ambiguous Circle response. The browser must never choose the idempotency key or
execution controls.

`apps/web` is a Next.js 16 application using App Router route handlers and explicitly
uses the Node runtime for the current operator plan route. The repository contains no
Dockerfile, Vercel project file, or alternative deployment manifest. It is compatible
with a Vercel/Next deployment, but the repository does not prove that Vercel is the
current provider. The selected design therefore assumes only stateless/serverless
request execution: multiple instances, restarts, and no process-memory durability.

## 3. Authentication options considered

| Option | Security and operations | Fit and decision |
| --- | --- | --- |
| Managed Next-compatible session provider | Mature OAuth/OIDC or equivalent session lifecycle, secret rotation and provider security; adds provider dependency, account setup, callback/origin configuration, and recurring operational coupling. Durable sessions require provider-backed or signed-cookie/session infrastructure. CSRF and callback checks remain necessary. | **Selected** for the small but custody-sensitive surface. It is safer and more extensible than inventing login/session cryptography, while remaining suitable for Next route handlers and server-only secrets. Keep the provider behind an interface. |
| Deployment/platform identity | Convenient if an existing trusted enterprise identity layer protects the deployment; often provider-specific and not shown in this repository. It can be strong, but portability and local/demo access are weaker. | Rejected as the baseline because no platform identity is currently established. Reconsider if deployment governance supplies one. |
| Wallet-signature authentication | Avoids a hosted login, but requires a server nonce, one-time consumption/replay protection, exact domain binding, chain/account binding policy, short-lived sessions, logout/expiry, and careful signature verification. A wallet address alone is not authentication. | Rejected for the first version due to greater custom security surface and operator usability friction. It can be a future option if wallet-native operator UX becomes a product requirement. |
| Server-managed operator session | Small custom login and cookie/session system can be made secure, but requires password/credential lifecycle, hashing, reset/recovery, CSRF, rotation, rate limiting, and durable session storage. | Rejected as unnecessary custom security work for one operator. |
| Static shared bearer secret | Simple to implement, but browser entry/storage, leakage, rotation, replay and auditability are poor. A permanent raw secret typed into the browser is not an acceptable preferred production design. | Rejected. |

The selected provider must issue a stable authenticated subject and a secure,
HttpOnly, Secure production session. The application must validate issuer/audience,
expiry, callback/redirect policy, and request CSRF/origin protections according to
the provider protocol. A session is authentication, not operator authorization.

## 4. Selected authentication and authorization

The future adapter should implement `OperatorAuthorizationGateway`:

```text
authenticated provider subject
        -> server-side operator allowlist/role record
        -> OperatorPrincipal { subject, role: "operator" }
```

The first production bootstrap may use a one-subject server-side allowlist. It must
not accept `role=operator`, an operator address, or an operator boolean from the
browser. Later, the same mapping can become an operator table with disabled status,
audit metadata, and multiple operators without changing execution domain code.

Store `requested_by_subject` (and, if approval is separated later,
`authorized_by_subject`) as stable provider subject identifiers. This materially
improves auditability without storing unnecessary profile data. Application identity
and authorization are separate from the onchain `OPERATOR_ROLE` address; they must
not be silently equated.

## 5. Durable-store options considered

| Option | Assessment |
| --- | --- |
| Managed/serverless Postgres | **Selected.** Durable, multi-instance safe, relational constraints, transactions, conditional updates, migrations, audit queries, and portable SQL. A low-cost managed tier is practical for a grant/demo-sized workload. |
| Self-managed Postgres | Meets requirements but adds backups, patching, networking, and availability work with no benefit at this scale. |
| Durable KV | Can work with conditional puts and version tokens, but schema/audit queries and multi-field state transitions are less transparent; provider semantics must be verified. Not the minimum-risk choice here. |
| Redis-compatible service | Suitable for locks/ephemeral coordination, but durability, backup, persistence mode, and audit modeling vary. It is unnecessary as a second system for this record. |
| SQLite/local file | Reject: local filesystem/process affinity is not a durable shared store on serverless deployment. |
| Process memory/browser storage | Reject: neither survives restart or coordinates instances; browser storage is never server execution storage. |

Use a portable `OperatorExecutionStore` implementation. The initial provider can be
a managed serverless Postgres service, but domain logic must not import its SDK or
SQL details directly. An ORM is optional and deliberately not selected in this
decision phase.

## 6. Minimum logical schema

Logical table: `operator_execution`.

| Column | Requirement |
| --- | --- |
| `id` | Internal UUID/opaque database identifier. Never required in public status. |
| `operation` | `create-order` or `release-order`. |
| `order_id` | Canonical normalized order identifier. |
| `progress` | Prepared/submitting/submitted/confirmation-pending/complete/rejected/ambiguous. |
| `idempotency_key` | Server-generated UUIDv4, unique and private. |
| `circle_transaction_id` | Nullable; stored when Circle returns it. |
| `transaction_hash` | Nullable; stored only after validation. |
| `internal_error_code` | Nullable bounded code; no raw SDK error, stack, or secret. |
| `requested_by_subject` | Stable authenticated subject for audit. |
| `created_at`, `updated_at` | Timestamps. |
| `version` | Monotonic optimistic-concurrency field. |

Require `UNIQUE(operation, order_id)` (or an equivalent durable collision
guarantee), and preferably a unique constraint on `idempotency_key`. Do not expose
`id`, `idempotency_key`, Circle IDs, or internal errors in browser responses.

The minimum safe mechanism is a transactionally atomic insert-if-absent followed by
version-checked updates (`WHERE id = ? AND version = ?`, incrementing version).
The store may use row locking for a short transition transaction, but does not need
a separate distributed lock. A conflict returns the existing record for duplicate
policy/recovery handling rather than creating another logical attempt.

## 7. Idempotency and recovery behavior

The Circle idempotency key is not an API key, Entity Secret, or private key. It is
nevertheless operationally sensitive because it identifies the recovery attempt. It
must be generated server-side, persisted before submission, reused for ambiguous
recovery, excluded from browser responses and logs, and never committed.

Database access controls, TLS, provider backups, least-privilege credentials, and
provider-managed encryption at rest are sufficient for the first version; a separate
application-level encryption layer is not required by this decision. This is not a
claim that database access controls eliminate all risk. If internal error metadata
ever contains sensitive payloads, do not store that payload; retain only bounded
codes. Rotate database credentials through the deployment secret manager.

The recovery contract is:

```text
prepared -> persist key -> submitting -> one Circle submission
                         -> known ID: submitted/confirmation-pending
                         -> unknown outcome: ambiguous
ambiguous -> load same record/key -> query/reconcile -> complete or manual review
```

There is no automatic replacement UUID. This provides duplicate suppression and
at-most-one logical execution intent, not mathematically perfect exactly-once
external execution: a remote API and a database cannot be committed atomically.

## 8. Trusted origin and enable gate

Configure the exact server-only value:

```text
SETTLE_APP_ORIGIN=https://operator.example
```

It must be an exact origin with no path, wildcard, credentials, or trailing slash;
production must use HTTPS. Never derive the expected origin from a browser header.
Use an explicit development value such as `http://localhost:3000` only when the
development-only insecure option is deliberately enabled. Do not trust every
`*.vercel.app` preview URL. Production execution should be disabled on previews.

Also require:

```text
SETTLE_OPERATOR_EXECUTION_ENABLED=true
```

Absent or false means disabled. The flag is additive: it cannot replace
authentication, server-side role mapping, exact origin checks, canonical-state
checks, or a durable store. Production must explicitly opt in; preview and local
development default to disabled.

## 9. Crash recovery matrix

| Window | Safe behavior |
| --- | --- |
| A. Record created, Circle not started | Record remains `prepared`; a future authorized request may submit the same prepared record after rechecking canonical state. No second record is created. |
| B. Marked `submitting`, process dies before request | Treat as uncertain, not as proof of non-submission. Move/reconcile to `ambiguous` using the same key, then perform the provider-supported existing-request/status check. Manual review blocks unsafe blind retry. |
| C. Circle received request, app dies before ID persistence | The durable key existed before the request. On restart, load the record and use the same idempotency identity to query/reconcile the original attempt. If Circle returns the original result, persist its transaction ID and continue confirmation. Never create a replacement UUID. If the provider cannot identify the attempt, keep `ambiguous` and require bounded manual investigation. |
| D. Transaction ID persisted, confirmation incomplete | Keep `submitted` or `confirmation-pending`; later recovery polls/reads the known transaction and canonical chain state. It is not a new execution. |

The most dangerous window is C because submission and persistence are separate
systems. Persisting the key first makes recovery idempotent, but does not prove
exactly-once delivery or guarantee that Circle's lookup API is available. The safe
outcome is reconciliation or manual review, never an automatic replacement attempt.

## 10. Environment and runtime boundary

All of the following remain server-only and must never use `NEXT_PUBLIC_*`:

- Circle API credentials and Entity Secret;
- authentication provider secret, issuer/audience configuration, and session key;
- database URL/credentials;
- `SETTLE_APP_ORIGIN`;
- `SETTLE_OPERATOR_EXECUTION_ENABLED`;
- server-side operator subject allowlist/role configuration;
- Circle wallet identifiers and operator/custody configuration.

The existing public chain/read configuration can remain public only where the current
code explicitly requires it; custody credentials and execution controls cannot.
Do not edit `.env` with real values or print existing secret contents.

| Environment | Origin | Execution |
| --- | --- | --- |
| Production | One configured HTTPS production origin | Disabled unless explicitly enabled after every prerequisite is verified |
| Preview | No trusted execution origin; optionally a non-execution preview origin | Always disabled |
| Development | Explicit localhost origin only when testing provenance | Disabled by default; never connected to production custody |

This design is compatible with stateless Vercel/Next route execution because all
execution state is in Postgres and all authentication/session verification is shared
through the provider or durable session mechanism. It does not depend on one Node
process, local files, or process memory.

## 11. Grant/demo scope decision

**Path A — add auth, database, and execute route now:** increases grant surface-area
and may look more complete, but introduces provider setup, migrations, secret
management, recovery testing, custody mutation risk, and a larger security review.
The extra UI capability is not needed to prove the Circle-controlled lifecycle.

**Path B — keep execution disabled:** presents the deployed verified contract, Circle
Developer-Controlled Wallet evidence, real outbound transfer and contract-call
proof, real create/approve/fund/release lifecycle proof, buyer orchestration, and
the server-only operator dry-run boundary. It preserves a clear security posture and
keeps this phase reviewable.

**Recommendation: Path B.** Grant credibility is stronger when the demonstrated
claims are independently evidenced and the intentionally disabled custody boundary
is explicit. Implement production execution infrastructure only after grant scope
and operational ownership justify it.

## 12. Explicit prerequisites before an execute route

1. Select and configure a managed auth provider; validate callback, session expiry,
   logout, CSRF/origin behavior, and secret rotation.
2. Implement the provider adapter and server-side subject allowlist/role mapping.
3. Provision managed Postgres, migration, least-privilege credentials, backups,
   retention, and the `operator_execution` constraints above.
4. Implement atomic create-if-absent and version-checked state transitions in the
   `OperatorExecutionStore` adapter.
5. Implement Circle existing-request/status reconciliation and bounded manual
   review for ambiguous outcomes; test crash windows, especially C.
6. Configure one exact production origin; keep previews disabled.
7. Add and verify the false-by-default execution flag and deployment checks.
8. Add the execute route only after code review, security tests, operational runbook,
   monitoring/redaction, and a non-production rehearsal.

## 13. Rejected shortcuts

- Browser-supplied role, wallet address, expected origin, execute flag, retry control,
  Circle ID, or idempotency key.
- Wallet address alone, custom session cryptography without a strong need, or a raw
  permanent browser bearer secret.
- Process memory, local filesystem/SQLite, browser storage, or a single-instance
  assumption.
- Trusting all preview domains or deriving expected origin from request headers.
- Generating a replacement UUID after a timeout or lost Circle response.
- Treating `submitting` as proof that no remote request happened, or claiming
  exactly-once semantics across Circle and the database.
- Coupling domain logic directly to one database SDK or equating app identity with
  onchain `OPERATOR_ROLE`.

## 14. Implementation roadmap after D4B3B3A

**D4B3C — auth adapter:** provider integration, secure session verification, subject
allowlist, and route-level origin/CSRF tests; no execution until the gate remains
closed in incomplete environments.

**D4B3D — durable store:** schema/migration, Postgres adapter, uniqueness and
compare-and-set tests, redacted audit fields, and restart/multi-instance tests.

**D4B3E — recovery:** one-shot Circle submission adapter, existing-request lookup,
transaction status and chain reconciliation, bounded manual-review runbook, and
fault-injection tests for windows A–D.

**D4B3F — controlled enablement:** production-only origin and flag configuration,
monitoring, alerting, rollback/disable procedure, staged non-production rehearsal,
and only then a separately reviewed execute route/UI.

No package installation, external account creation, database creation, credential
generation, Circle call, transaction submission, commit, or push belongs to D4B3B3A.