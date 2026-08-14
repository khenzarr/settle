import { sql } from "drizzle-orm";
import { char, check, foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { merchantEnvironments, merchants } from "./merchants.ts";
import { paymentIntents } from "./payment-intents.ts";

export const webhookEndpointStatusEnum = pgEnum("webhook_endpoint_status", ["active", "disabled"]);
export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", ["pending", "delivering", "delivered", "retrying", "exhausted", "dead_letter"]);
export const webhookAttemptOutcomeEnum = pgEnum("webhook_attempt_outcome", ["delivered", "retryable_failure", "terminal_failure"]);

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  url: text("url").notNull(),
  description: varchar("description", { length: 160 }),
  signingSecretCiphertext: text("signing_secret_ciphertext").notNull(),
  secretVersion: integer("secret_version").default(1).notNull(),
  status: webhookEndpointStatusEnum("status").default("active").notNull(),
  subscriptions: jsonb("subscriptions").$type<readonly string[]>().notNull(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "webhook_endpoints_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  unique("webhook_endpoints_environment_url_unique").on(table.environmentId, table.url),
  unique("webhook_endpoints_tenant_id_unique").on(table.merchantId, table.environmentId, table.id),
  index("webhook_endpoints_tenant_status_idx").on(table.merchantId, table.environmentId, table.status, table.createdAt),
  check("webhook_endpoints_https_url", sql`${table.url} ~ '^https://[^/[:space:]]+(?::443)?(?:/[^[:space:]]*)?$' and length(${table.url}) <= 2048`),
  check("webhook_endpoints_description_not_blank", sql`${table.description} is null or length(btrim(${table.description})) > 0`),
  check("webhook_endpoints_ciphertext_not_blank", sql`length(${table.signingSecretCiphertext}) between 32 and 4096`),
  check("webhook_endpoints_secret_version_positive", sql`${table.secretVersion} > 0`),
  check("webhook_endpoints_subscriptions_array", sql`jsonb_typeof(${table.subscriptions}) = 'array' and jsonb_array_length(${table.subscriptions}) between 1 and 16`),
]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  paymentIntentId: uuid("payment_intent_id").references(() => paymentIntents.id, { onDelete: "restrict" }),
  type: varchar("type", { length: 100 }).notNull(),
  schemaVersion: integer("schema_version").default(1).notNull(),
  payload: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
  payloadHash: char("payload_hash", { length: 64 }).notNull(),
  canonicalEventKey: varchar("canonical_event_key", { length: 160 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "webhook_events_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  foreignKey({ name: "webhook_events_intent_owner_fk", columns: [table.merchantId, table.environmentId, table.paymentIntentId], foreignColumns: [paymentIntents.merchantId, paymentIntents.environmentId, paymentIntents.id] }).onDelete("restrict"),
  unique("webhook_events_event_id_unique").on(table.id),
  unique("webhook_events_tenant_id_unique").on(table.merchantId, table.environmentId, table.id),
  unique("webhook_events_intent_semantic_unique").on(table.paymentIntentId, table.type, table.canonicalEventKey),
  index("webhook_events_tenant_created_idx").on(table.merchantId, table.environmentId, table.createdAt),
  index("webhook_events_intent_created_idx").on(table.paymentIntentId, table.createdAt),
  check("webhook_events_type_not_blank", sql`length(btrim(${table.type})) > 0`),
  check("webhook_events_schema_version_positive", sql`${table.schemaVersion} > 0`),
  check("webhook_events_payload_object", sql`jsonb_typeof(${table.payload}) = 'object'`),
  check("webhook_events_payload_hash_format", sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`),
  check("webhook_events_canonical_key_not_blank", sql`length(btrim(${table.canonicalEventKey})) > 0`),
]);

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  eventId: uuid("event_id").notNull().references(() => webhookEvents.id, { onDelete: "restrict" }),
  endpointId: uuid("endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "restrict" }),
  status: webhookDeliveryStatusEnum("status").default("pending").notNull(),
  attemptCount: integer("attempt_count").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  responseStatus: integer("response_status"),
  responseCode: varchar("response_code", { length: 120 }),
  requestSignatureVersion: integer("request_signature_version"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  leaseOwner: varchar("lease_owner", { length: 120 }),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "webhook_deliveries_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  foreignKey({ name: "webhook_deliveries_event_owner_fk", columns: [table.merchantId, table.environmentId, table.eventId], foreignColumns: [webhookEvents.merchantId, webhookEvents.environmentId, webhookEvents.id] }).onDelete("restrict"),
  foreignKey({ name: "webhook_deliveries_endpoint_owner_fk", columns: [table.merchantId, table.environmentId, table.endpointId], foreignColumns: [webhookEndpoints.merchantId, webhookEndpoints.environmentId, webhookEndpoints.id] }).onDelete("restrict"),
  unique("webhook_deliveries_event_endpoint_unique").on(table.eventId, table.endpointId),
  unique("webhook_deliveries_tenant_id_unique").on(table.merchantId, table.environmentId, table.id),
  index("webhook_deliveries_claimable_idx").on(table.status, table.nextAttemptAt, table.leaseUntil),
  index("webhook_deliveries_endpoint_created_idx").on(table.endpointId, table.createdAt),
  check("webhook_deliveries_attempt_count_nonnegative", sql`${table.attemptCount} >= 0`),
  check("webhook_deliveries_response_status", sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`),
  check("webhook_deliveries_signature_version_positive", sql`${table.requestSignatureVersion} is null or ${table.requestSignatureVersion} > 0`),
  check("webhook_deliveries_delivery_consistent", sql`(${table.status} = 'delivered' and ${table.deliveredAt} is not null) or (${table.status} <> 'delivered' and ${table.deliveredAt} is null)`),
  check("webhook_deliveries_lease_pair", sql`(${table.leaseOwner} is null and ${table.leaseUntil} is null) or (${table.leaseOwner} is not null and ${table.leaseUntil} is not null)`),
]);

export const webhookDeliveryAttempts = pgTable("webhook_delivery_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  deliveryId: uuid("delivery_id").notNull().references(() => webhookDeliveries.id, { onDelete: "restrict" }),
  attemptNumber: integer("attempt_number").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
  outcome: webhookAttemptOutcomeEnum("outcome").notNull(),
  responseStatus: integer("response_status"),
  failureCode: varchar("failure_code", { length: 120 }),
  durationMs: integer("duration_ms").notNull(),
  signatureVersion: integer("signature_version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("webhook_delivery_attempts_delivery_number_unique").on(table.deliveryId, table.attemptNumber),
  index("webhook_delivery_attempts_delivery_created_idx").on(table.deliveryId, table.createdAt),
  index("webhook_delivery_attempts_outcome_created_idx").on(table.outcome, table.createdAt),
  check("webhook_delivery_attempts_number_positive", sql`${table.attemptNumber} > 0`),
  check("webhook_delivery_attempts_time_order", sql`${table.finishedAt} >= ${table.startedAt}`),
  check("webhook_delivery_attempts_response_status", sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`),
  check("webhook_delivery_attempts_duration_nonnegative", sql`${table.durationMs} >= 0`),
  check("webhook_delivery_attempts_signature_version_positive", sql`${table.signatureVersion} > 0`),
]);
