# Settle M1 Data Model

Relational model for merchant application state. PostgreSQL is the system of record for
these operational records; it never replaces `SettlementEscrow` as payment truth.

## Conventions

Use UUIDv4/UUIDv7 internal IDs, UTC `timestamptz`, `numeric(78,0)` or text-safe bigint
mapping for USDC base units, lowercase normalized EVM addresses, and immutable hashes as
`char(66)`. Every tenant-owned table carries `merchant_id`; repositories require the
merchant context and never accept it from an untrusted body. `created_at` and
`updated_at` are common fields. Soft disable is preferred over deletion for security
records.

## Tables

### `merchants`

Purpose: tenant and business lifecycle. PK `id`. Fields: `slug`, `name`, `status`
(`pending|active|suspended|closed`), `default_environment`, `created_at`,
`updated_at`. Unique `slug`; index `(status, created_at)`. No secrets. Retain account
and audit references after closure; restrict PII access.

### `merchant_members`

Purpose: map auth-provider subjects to a merchant. PK `id`; FK `merchant_id` cascade
restricted by policy. Fields `provider`, `subject`, `role` (`owner|admin|developer|
viewer`), `status`, timestamps. Unique `(provider, subject, merchant_id)` and index
`(merchant_id,status)`. Never infer role from browser claims.

### `merchant_environments`

Purpose: test/live isolation and per-environment settings. PK `id`; FK merchant.
Fields `kind` (`test|live`), `status` (`active|disabled`), `display_name`,
`checkout_origin`, `settings_json`, timestamps. Unique `(merchant_id,kind)`, index
`(merchant_id,status)`. M1 enables test only; live rows are inert until approved.

### `merchant_settings`

Purpose: mutable merchant defaults without widening the account row. PK/FK
`merchant_id` one-to-one. Fields `default_webhook_tolerance_seconds`, bounded
`statement_descriptor`, `support_email`, `version`, timestamps. Unique merchant FK;
index is the PK. Contact fields are sensitive application data and must not enter
public logs. Retain versioned changes through `audit_events`; do not store provider
credentials or execution policy here.

### `merchant_api_keys`

Purpose: merchant credentials. PK `id`; FKs merchant and environment. Fields
`name`, `key_id` (public identifier), `prefix`, `secret_digest`, `digest_version`,
`scopes_json`, `last_used_at`, `expires_at`, `revoked_at`, `created_by_member_id`,
timestamps. Unique `key_id`, unique `(environment_id,prefix)`; index
`(merchant_id,environment_id,revoked_at)`. The HMAC digest and usage timestamps are
sensitive; the HMAC pepper remains outside the database. Raw secret is never stored,
logged, or recoverable. Retain revoked metadata for audit.

### `payment_intents`

Purpose: merchant-facing intent and application lifecycle. PK `id`; FKs merchant,
environment, optionally creator. Fields `external_order_id`, `buyer_address`,
`amount_base_units`, `currency`, `funding_deadline`, `settlement_deadline`,
`order_id`, `terms_hash`, `application_state`, `checkout_path`, `activated_at`,
`funded_at`, `completed_at`, `refunded_at`, `cancelled_at`, `canonical_status`,
`canonical_observed_at`, `reconciliation_state`, timestamps. Unique
`(merchant_id,environment_id,id)` and `(merchant_id,environment_id,external_order_id)`;
unique `(environment_id,order_id)`; indexes `(merchant_id,environment_id,created_at)`,
`(merchant_id,application_state)`, `(canonical_status,canonical_observed_at)`. Store
external references and hashes; never store private keys. Retain financial records.

### `payment_intent_recipients`

Purpose: immutable settlement allocation. PK `id`; FK payment intent. Fields
`recipient_address`, `share_bps`, `ordinal`, optional computed payout snapshot.
Unique `(payment_intent_id,recipient_address)` and `(payment_intent_id,ordinal)`;
index payment intent. Enforce 1–8 recipients, positive shares, total 10,000 in a
transaction/application validation. Retain with intent.

### `chain_orders`

Purpose: chain identity and last verified contract projection. PK `id`; FK intent
unique one-to-one. Fields `contract_address`, `chain_id`, `order_id`, `terms_hash`,
`last_verified_block`, `last_verified_block_hash`, `last_verified_status`,
`last_verified_payload_hash`, `last_verified_at`, `verification_state`. Unique
`(chain_id,contract_address,order_id)`; index `(verification_state,last_verified_at)`.
Never update immutable identity fields after activation; retain all versions in
observations.

### `idempotency_keys`

Purpose: merchant-scoped safe retries. PK `id`; FKs merchant/environment and optional
intent. Fields `key_digest`, `request_fingerprint`, `status`, `response_status`,
`response_body_json`, `resource_id`, `expires_at`, timestamps. Unique
`(merchant_id,environment_id,key_digest)`; index expiry. Digest is sensitive but not a
recoverable credential. Keep successful results through the documented replay window;
retain conflict/audit metadata longer.

### `webhook_endpoints`

Purpose: merchant destinations. PK `id`; FKs merchant/environment. Fields `url`,
`description`, `signing_secret_ciphertext`, `secret_version`, `status`, subscribed
event types, `last_success_at`, timestamps. Unique `(environment_id,url)`; index
merchant/status. Secret is highly sensitive, encrypted with KMS-backed application
key; show only once and rotate by version. Retain disabled endpoint metadata.

### `webhook_events`

Purpose: immutable merchant event envelope. PK `id` and public `event_id` (ULID/UUID).
FK merchant/environment/intent. Fields `type`, `schema_version`, `payload_json`,
`payload_hash`, `occurred_at`, `created_at`. Unique `event_id`; unique
`(intent_id,type,canonical_event_key)` to prevent duplicate semantic events; indexes
merchant/time and intent/time. Retain financial event history; redact PII according to
policy.

### `webhook_deliveries`

Purpose: per endpoint attempt state. PK `id`; FKs event/endpoint. Fields `status`,
`attempt_count`, `next_attempt_at`, `last_attempt_at`, `response_status`, bounded
`response_code`, `request_signature_version`, `delivered_at`, `lease_until`,
timestamps. Unique `(event_id,endpoint_id)`; indexes claimable `(status,next_attempt_at)`
and endpoint/time. Retain full delivery history for an operational period, then keep
summary/audit records.

### `webhook_delivery_attempts`

Purpose: immutable log of each network attempt. PK `id`; FK delivery. Fields
`attempt_number`, `started_at`, `finished_at`, `outcome`, `response_status`, bounded
`failure_code`, `duration_ms`, and `signature_version`. Unique
`(delivery_id,attempt_number)`; indexes delivery/time and outcome/time. URLs, response
bodies, request headers, and signing secrets are not copied here. Retain detailed
attempts for a bounded operational period, then aggregate or delete under policy while
preserving delivery/event audit records.

### `reconciliation_cursors`

Purpose: durable chain scanner checkpoint. PK `(chain_id,contract_address)`.
Fields `next_block`, `last_safe_block`, `last_block_hash`, `status`, `failure_count`,
`lease_until`, timestamps. Unique by chain/contract; never advance past unverified
logs. Retain cursor history in audit when reset.

### `chain_observations`

Purpose: raw normalized event/read evidence. PK `id`; FK chain order optional.
Fields `chain_id`, `contract_address`, `order_id`, `event_kind`, `tx_hash`,
`block_number`, `block_hash`, `log_index`, `decoded_json`, `observation_hash`,
`observed_at`, `verification_result`. Unique `(chain_id,contract_address,tx_hash,log_index)`;
indexes order/block and verification result. Store bounded decoded data, not arbitrary
RPC responses. Financial evidence retention is long-lived.

### `operator_executions`

Purpose: controlled Circle operation evidence, not a public execution API. PK `id`;
FK merchant/environment/intent optional. Fields `operation`, `state`, server-generated
`idempotency_key_digest`, `circle_transaction_id`, `transaction_hash`, `requested_by_subject`,
`canonical_precondition_hash`, bounded `failure_code`, `ambiguous_at`, `completed_at`,
version, timestamps. Unique logical `(intent_id,operation)` and unique Circle ID;
indexes state/next action. Never store raw Circle payloads, credentials, or keys.

### `audit_events`

Purpose: append-only security/operational trail. PK `id`; optional merchant/member FK.
Fields `actor_type`, `actor_subject`, `action`, `resource_type`, `resource_id`,
`request_id`, `metadata_json` (allowlisted), `created_at`. Index merchant/time,
resource/time, action/time. Exclude secrets, authorization headers, full payloads,
and raw provider errors. Retain according to security and financial audit policy.

## Transaction and integrity rules

Create intent, recipients, and the initial idempotency result in one transaction.
Activation writes the operation record and chain identity atomically with an explicit
state transition. Webhook event creation and its endpoint delivery rows are one
transaction. Reconciliation uses compare-and-set cursor updates and never projects a
new canonical state without validating the complete order read.

Use database constraints for tenant/environment uniqueness, application validation for
hash/amount/split rules, and row leases/version checks for workers. `DELETE` is not a
retry strategy; records are marked revoked, disabled, exhausted, or superseded.
