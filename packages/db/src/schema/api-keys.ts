import { sql } from "drizzle-orm";
import { check, char, foreignKey, index, integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { merchantEnvironments, merchantMembers, merchants } from "./merchants.ts";

export const merchantApiKeys = pgTable("merchant_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  keyId: char("key_id", { length: 22 }).notNull(),
  prefix: varchar("prefix", { length: 40 }).notNull(),
  secretDigest: char("secret_digest", { length: 64 }).notNull(),
  digestVersion: integer("digest_version").default(1).notNull(),
  scopesJson: jsonb("scopes_json").$type<readonly string[]>().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdByMemberId: uuid("created_by_member_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "merchant_api_keys_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  foreignKey({ name: "merchant_api_keys_creator_owner_fk", columns: [table.merchantId, table.createdByMemberId], foreignColumns: [merchantMembers.merchantId, merchantMembers.id] }).onDelete("restrict"),
  unique("merchant_api_keys_key_id_unique").on(table.keyId),
  unique("merchant_api_keys_environment_prefix_unique").on(table.environmentId, table.prefix),
  index("merchant_api_keys_tenant_revoked_idx").on(table.merchantId, table.environmentId, table.revokedAt),
  check("merchant_api_keys_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  check("merchant_api_keys_key_id_format", sql`${table.keyId} ~ '^[A-Za-z0-9_-]{22}$'`),
  check("merchant_api_keys_prefix_format", sql`${table.prefix} ~ '^sk_test_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$'`),
  check("merchant_api_keys_digest_format", sql`${table.secretDigest} ~ '^[0-9a-f]{64}$'`),
  check("merchant_api_keys_digest_version_positive", sql`${table.digestVersion} > 0`),
  check("merchant_api_keys_scopes_array", sql`jsonb_typeof(${table.scopesJson}) = 'array' and jsonb_array_length(${table.scopesJson}) between 1 and 16`),
  check("merchant_api_keys_scopes_allowlist", sql`${table.scopesJson} <@ '["payment_intents:read", "payment_intents:write", "webhook_endpoints:read", "webhook_endpoints:write"]'::jsonb`),
  check("merchant_api_keys_expiry_after_creation", sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`),
  check("merchant_api_keys_revocation_after_creation", sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`),
]);
