import { sql } from "drizzle-orm";
import { check, foreignKey, index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { auditActorTypeEnum } from "./enums.ts";
import { merchantEnvironments, merchants } from "./merchants.ts";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id"),
  actorType: auditActorTypeEnum("actor_type").notNull(),
  actorSubject: varchar("actor_subject", { length: 255 }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resource_type", { length: 80 }).notNull(),
  resourceId: varchar("resource_id", { length: 160 }),
  requestId: uuid("request_id"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "audit_events_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  index("audit_events_merchant_created_idx").on(table.merchantId, table.createdAt),
  index("audit_events_resource_created_idx").on(table.resourceType, table.resourceId, table.createdAt),
  index("audit_events_action_created_idx").on(table.action, table.createdAt),
  check("audit_events_tenant_pair", sql`(${table.merchantId} is null and ${table.environmentId} is null) or ${table.merchantId} is not null`),
  check("audit_events_actor_not_blank", sql`length(btrim(${table.actorSubject})) > 0`),
  check("audit_events_action_not_blank", sql`length(btrim(${table.action})) > 0`),
  check("audit_events_resource_type_not_blank", sql`length(btrim(${table.resourceType})) > 0`),
]);