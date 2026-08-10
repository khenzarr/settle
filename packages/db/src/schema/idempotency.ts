import { sql } from "drizzle-orm";
import { check, char, foreignKey, index, integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { idempotencyStatusEnum } from "./enums.ts";
import { merchantEnvironments, merchants } from "./merchants.ts";

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  keyDigest: char("key_digest", { length: 64 }).notNull(),
  requestFingerprint: char("request_fingerprint", { length: 64 }).notNull(),
  resourceType: varchar("resource_type", { length: 80 }).notNull(),
  resourceId: varchar("resource_id", { length: 160 }),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body_json").$type<Record<string, unknown>>(),
  status: idempotencyStatusEnum("status").default("processing").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  foreignKey({ name: "idempotency_keys_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  unique("idempotency_keys_tenant_key_unique").on(table.merchantId, table.environmentId, table.keyDigest),
  index("idempotency_keys_expiry_idx").on(table.expiresAt),
  index("idempotency_keys_tenant_resource_idx").on(table.merchantId, table.environmentId, table.resourceType, table.resourceId),
  check("idempotency_keys_digest_format", sql`${table.keyDigest} ~ '^[0-9a-f]{64}$'`),
  check("idempotency_keys_fingerprint_format", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
  check("idempotency_keys_resource_type_not_blank", sql`length(btrim(${table.resourceType})) > 0`),
  check("idempotency_keys_expiry_after_creation", sql`${table.expiresAt} > ${table.createdAt}`),
  check("idempotency_keys_response_status", sql`${table.responseStatus} is null or ${table.responseStatus} between 100 and 599`),
]);