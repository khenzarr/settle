# Settle M1 Security Model

## Trust boundaries

| Boundary | Required rule |
|---|---|
| Merchant server -> Settle API | HTTPS, scoped environment API key, tenant authorization, rate limits, strict schemas, idempotency |
| Merchant browser -> Settle dashboard | Managed session, CSRF/origin protection, no secrets in client bundle, server-side authorization |
| Buyer browser -> Arc | Buyer wallet signs/submits only exact prepared approval/funding; Settle never holds buyer keys |
| Settle API/worker -> Arc RPC | Read-only RPC adapter, chain/address allowlist, timeouts/retries, response validation, no RPC-supplied identity |
| Settle server -> Circle | Node-only gateway, secret manager, wallet/address/network preflight, explicit operation gate, no public arbitrary calls |
| Settle -> PostgreSQL | TLS, least-privilege role, parameterized/typed queries, tenant predicates, migrations, backups, audit trail |
| Settle -> merchant webhook | HTTPS destination validation, signed raw body, event ID/timestamp, bounded retries and replay controls |

## Credential and session controls

API key secrets are 256 random bits generated with the platform CSPRNG, shown once,
and stored only as `HMAC-SHA-256(server_pepper, full_key)` plus a public prefix/key ID.
The pepper is versioned in the secret manager, never in PostgreSQL. A password KDF is
not needed for uniformly random secrets and would amplify authentication DoS cost.
Verification looks up by key ID, checks merchant/environment/status/scope/expiry, then
compares the recomputed digest in constant time. Errors do not distinguish unknown key
ID from wrong secret; perform bounded dummy verification for unknown IDs. Rotate by
issuing a new key; revoke immediately; never log `Authorization`, raw keys, digests,
or full request headers. Apply per-key, per-merchant, and IP rate limits.

Dashboard auth uses a managed OIDC-compatible provider through an adapter. Validate
issuer, audience, nonce, redirect URI, expiry, and secure HttpOnly/SameSite cookies.
Map provider subject to a database membership and status; never trust client role
claims, wallet addresses, or merchant IDs. Require CSRF tokens or strict same-origin
checks for state-changing browser requests. Sign-out invalidates the session.

## Tenant isolation and abuse controls

Every repository call takes authenticated tenant/environment context. Resource IDs,
external order IDs, webhook IDs, and key IDs are filtered by that context before any
response. Return uniform `404` for cross-merchant objects. Enforce payload size,
recipient count, metadata size, URL allowlists, pagination limits, deadline bounds,
and per-route rate limits. Idempotency keys are merchant/environment scoped; reject
fingerprint conflicts and cap retained response bodies.

Duplicate payments are prevented by immutable `(environment, orderId)` mapping and the
contract's buyer/status checks. A second intent with equal terms is a separate
application decision, not permission to fund the same onchain order. Never accept raw
USDC transfers as a substitute for `fundOrder`.

## Webhook authenticity and replay

Sign the exact UTF-8 body with HMAC-SHA256 using an endpoint-specific secret. Send
`Settle-Signature: t=<unix>,v1=<hex>` and `Settle-Event-Id`. Merchant verification
must check timestamp tolerance, constant-time signature comparison, and event-ID
deduplication. Settle stores one immutable event and one delivery row per endpoint;
retries reuse the event ID and payload but may use a new timestamp/signature. Never
allow a merchant to submit an arbitrary event payload through replay. Manual replay is
owner/admin scoped, rate-limited, and audited.

Validate endpoint URLs as HTTPS, reject loopback/private/link-local destinations in
production, limit redirects, cap response body/time, and do not forward credentials.
Store only bounded response status/code; redact response bodies by default.

## Chain and reconciliation safety

The reconciler uses an allowlisted chain ID, contract, and USDC address. It scans with
an exclusive durable cursor, stores `(tx_hash,log_index)` uniqueness, validates block
hash continuity where available, decodes the known ABI, and retries transient RPC
failures with bounded backoff. It then performs a complete `getOrder`/splits read.

`Completed` requires a successful Arc receipt and canonical `OrderReleased` state;
Circle `COMPLETE` alone is insufficient. A missing log, mismatched buyer/amount/hash/
split, reorg suspicion, malformed response, or unexpected status produces a
`reconciliation_issue`, retains evidence, alerts, and blocks unsafe execution. The DB
projection is repaired from a later verified chain read, never the reverse.

## Circle and operator boundary

Circle credentials, Entity Secret, wallet IDs, execution controls, internal Circle
idempotency keys, and role configuration are server-only. Circle operations are
allowlisted to known Settle actions and canonical contract address/function signatures.
The existing fail-closed authorization gateway, exact origin checks, durable execution
record requirement, and ambiguous outcome recovery remain mandatory. There is no public
operator route and no browser import of `@settle/circle`.

Persist a server-generated provider idempotency identity before submission. If the
response is ambiguous, query the same operation/status and chain; never generate a
replacement automatically. Keep only bounded error codes and sanitized request IDs.

## Logging, audit, and monitoring

Redact bearer tokens, API secrets, signing secrets, Circle credentials/ciphertext,
private keys, raw RPC/provider bodies, calldata, and sensitive personal data. Attach a
request ID, merchant ID only in protected logs, event ID, and operation ID. Audit key
creation/rotation/revocation, login/membership changes, intent mutations, webhook
configuration/replay, reconciliation divergence, and operator actions. Alert on key
failures, cross-tenant denials, webhook exhaustion, RPC cursor stalls, divergence,
Circle ambiguity, and repeated rate-limit violations.

## Security test gates

Test secret non-recovery and redaction, hash verification/rotation, session expiry and
CSRF, tenant isolation, scope enforcement, idempotency replay/conflict/concurrency,
duplicate chain logs, RPC outage/reorg/malformed data, webhook signature/timestamp/
replay/duplicate delivery, SSRF protections, Circle credential non-exposure, and
ambiguous operation crash windows. Security failures fail closed and do not fabricate
payment state.
