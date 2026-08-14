import { sql } from "drizzle-orm";
import { char, check, foreignKey, index, integer, pgEnum, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { merchantEnvironments, merchants } from "./merchants.ts";

export const rateLimitDimensionEnum = pgEnum("rate_limit_dimension", ["api_key", "merchant", "ip"]);

export const apiRateLimitBuckets = pgTable("api_rate_limit_buckets", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  dimension: rateLimitDimensionEnum("dimension").notNull(),
  subjectDigest: char("subject_digest", { length: 64 }).notNull(),
  routeGroup: varchar("route_group", { length: 80 }).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowSeconds: integer("window_seconds").notNull(),
  requestCount: integer("request_count").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "api_rate_limit_buckets_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  unique("api_rate_limit_buckets_identity_unique").on(table.merchantId, table.environmentId, table.dimension, table.subjectDigest, table.routeGroup, table.windowStart),
  index("api_rate_limit_buckets_expiry_idx").on(table.windowStart, table.windowSeconds),
  index("api_rate_limit_buckets_tenant_route_idx").on(table.merchantId, table.environmentId, table.routeGroup, table.windowStart),
  check("api_rate_limit_buckets_digest_format", sql`${table.subjectDigest} ~ '^[0-9a-f]{64}$'`),
  check("api_rate_limit_buckets_route_not_blank", sql`length(btrim(${table.routeGroup})) > 0`),
  check("api_rate_limit_buckets_window_range", sql`${table.windowSeconds} between 1 and 3600`),
  check("api_rate_limit_buckets_count_positive", sql`${table.requestCount} > 0`),
]);
