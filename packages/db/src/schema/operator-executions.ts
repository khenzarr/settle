import { sql } from "drizzle-orm";
import { char, check, foreignKey, index, numeric, pgEnum, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { merchantEnvironments, merchants } from "./merchants.ts";
import { paymentIntents } from "./payment-intents.ts";

export const operatorExecutionStateEnum = pgEnum("operator_execution_state", ["queued", "submitted", "succeeded", "failed", "ambiguous"]);

export const operatorExecutions = pgTable("operator_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  merchantId: uuid("merchant_id").notNull().references(() => merchants.id, { onDelete: "restrict" }),
  environmentId: uuid("environment_id").notNull(),
  paymentIntentId: uuid("payment_intent_id").notNull().references(() => paymentIntents.id, { onDelete: "restrict" }),
  operation: varchar("operation", { length: 40 }).notNull(),
  state: operatorExecutionStateEnum("state").default("queued").notNull(),
  providerIdempotencyDigest: char("provider_idempotency_digest", { length: 64 }).notNull(),
  providerOperationId: varchar("provider_operation_id", { length: 160 }),
  transactionHash: char("transaction_hash", { length: 66 }),
  chainId: numeric("chain_id", { precision: 78, scale: 0, mode: "bigint" }),
  requestedBySubject: varchar("requested_by_subject", { length: 160 }).notNull(),
  failureCode: varchar("failure_code", { length: 120 }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ name: "operator_executions_environment_owner_fk", columns: [table.merchantId, table.environmentId], foreignColumns: [merchantEnvironments.merchantId, merchantEnvironments.id] }).onDelete("restrict"),
  foreignKey({ name: "operator_executions_intent_owner_fk", columns: [table.merchantId, table.environmentId, table.paymentIntentId], foreignColumns: [paymentIntents.merchantId, paymentIntents.environmentId, paymentIntents.id] }).onDelete("restrict"),
  unique("operator_executions_intent_operation_unique").on(table.paymentIntentId, table.operation),
  unique("operator_executions_provider_digest_unique").on(table.providerIdempotencyDigest),
  unique("operator_executions_provider_operation_unique").on(table.providerOperationId),
  unique("operator_executions_transaction_hash_unique").on(table.transactionHash),
  index("operator_executions_tenant_state_idx").on(table.merchantId, table.environmentId, table.state, table.createdAt),
  check("operator_executions_operation_activation", sql`${table.operation} = 'activation'`),
  check("operator_executions_digest_format", sql`${table.providerIdempotencyDigest} ~ '^[0-9a-f]{64}$'`),
  check("operator_executions_transaction_evidence", sql`(${table.transactionHash} is null and ${table.chainId} is null and ${table.lastObservedAt} is null) or (${table.transactionHash} ~ '^0x[0-9a-f]{64}$' and ${table.chainId} > 0 and ${table.lastObservedAt} is not null)`),
  check("operator_executions_subject_not_blank", sql`length(btrim(${table.requestedBySubject})) > 0`),
]);
