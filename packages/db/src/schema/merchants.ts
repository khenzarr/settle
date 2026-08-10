import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";
import { merchantEnvironmentKindEnum, merchantEnvironmentStatusEnum, merchantMemberRoleEnum, merchantMemberStatusEnum, merchantStatusEnum } from "./enums.ts";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const merchants = pgTable("merchants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  status: merchantStatusEnum("status").default("pending").notNull(),
  ...timestamps,
}, (table) => [unique("merchants_slug_unique").on(table.slug), index("merchants_status_created_at_idx").on(table.status, table.createdAt), check("merchants_name_not_blank", sql`length(btrim(${table.name})) > 0`), check("merchants_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`)]);

export const merchantMembers = pgTable("merchant_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 80 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  role: merchantMemberRoleEnum("role").notNull(),
  status: merchantMemberStatusEnum("status").default("active").notNull(),
  ...timestamps,
}, (table) => [
  unique("merchant_members_provider_subject_merchant_unique").on(table.provider, table.subject, table.merchantId),
  index("merchant_members_merchant_status_idx").on(table.merchantId, table.status),
  check("merchant_members_provider_not_blank", sql`length(btrim(${table.provider})) > 0`),
  check("merchant_members_subject_not_blank", sql`length(btrim(${table.subject})) > 0`),
]);

export const merchantEnvironments = pgTable("merchant_environments", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  kind: merchantEnvironmentKindEnum("kind").notNull(),
  status: merchantEnvironmentStatusEnum("status").default("active").notNull(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  checkoutOrigin: text("checkout_origin"),
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (table) => [
  unique("merchant_environments_merchant_kind_unique").on(table.merchantId, table.kind),
  unique("merchant_environments_merchant_id_id_unique").on(table.merchantId, table.id),
  index("merchant_environments_merchant_status_idx").on(table.merchantId, table.status),
  check("merchant_environments_display_name_not_blank", sql`length(btrim(${table.displayName})) > 0`),
  check("merchant_environments_checkout_origin", sql`${table.checkoutOrigin} is null or ${table.checkoutOrigin} ~ '^https://[^/[:space:]]+(?::[0-9]+)?$'`),
]);

export const merchantSettings = pgTable("merchant_settings", {
  merchantId: uuid("merchant_id").primaryKey().references(() => merchants.id, { onDelete: "restrict" }),
  statementDescriptor: varchar("statement_descriptor", { length: 22 }),
  supportEmail: varchar("support_email", { length: 320 }),
  defaultWebhookToleranceSeconds: integer("default_webhook_tolerance_seconds").default(300).notNull(),
  version: integer("version").default(1).notNull(),
  ...timestamps,
}, (table) => [
  check("merchant_settings_webhook_tolerance_range", sql`${table.defaultWebhookToleranceSeconds} between 60 and 900`),
  check("merchant_settings_version_positive", sql`${table.version} > 0`),
  check("merchant_settings_descriptor_safe", sql`${table.statementDescriptor} is null or ${table.statementDescriptor} ~ '^[A-Za-z0-9 ._-]{1,22}$'`),
]);