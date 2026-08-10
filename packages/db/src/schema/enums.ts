import { pgEnum } from "drizzle-orm/pg-core";

export const merchantStatusEnum = pgEnum("merchant_status", ["pending", "active", "suspended", "closed"]);
export const merchantMemberRoleEnum = pgEnum("merchant_member_role", ["owner", "admin", "developer", "viewer"]);
export const merchantMemberStatusEnum = pgEnum("merchant_member_status", ["active", "disabled"]);
export const merchantEnvironmentKindEnum = pgEnum("merchant_environment_kind", ["test", "live"]);
export const merchantEnvironmentStatusEnum = pgEnum("merchant_environment_status", ["active", "disabled"]);
export const paymentIntentStateEnum = pgEnum("payment_intent_state", ["planned", "awaiting_activation", "awaiting_payment", "payment_window_expired", "funded", "disputed", "completed", "refunded", "cancelled"]);
export const canonicalOrderStatusEnum = pgEnum("canonical_order_status", ["none", "created", "funded", "disputed", "completed", "refunded", "cancelled"]);
export const chainVerificationStateEnum = pgEnum("chain_verification_state", ["unverified", "verified", "stale", "error"]);
export const idempotencyStatusEnum = pgEnum("idempotency_status", ["processing", "completed", "failed"]);
export const auditActorTypeEnum = pgEnum("audit_actor_type", ["system", "merchant_member", "merchant_api_key", "worker"]);