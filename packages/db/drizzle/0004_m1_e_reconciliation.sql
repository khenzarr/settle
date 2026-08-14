CREATE TYPE "public"."chain_observation_state" AS ENUM('canonical', 'orphaned');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_issue_state" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_issue_severity" AS ENUM('warning', 'error');--> statement-breakpoint
ALTER TABLE "operator_executions" ADD COLUMN "provider_operation_id" varchar(160);--> statement-breakpoint
ALTER TABLE "operator_executions" ADD COLUMN "transaction_hash" char(66);--> statement-breakpoint
ALTER TABLE "operator_executions" ADD COLUMN "chain_id" numeric(78, 0);--> statement-breakpoint
ALTER TABLE "operator_executions" ADD COLUMN "last_observed_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "chain_reconciliation_cursors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" numeric(78, 0) NOT NULL,
	"contract_address" char(42) NOT NULL,
	"deployment_block" numeric(78, 0) NOT NULL,
	"confirmation_depth" integer NOT NULL,
	"next_block" numeric(78, 0) NOT NULL,
	"last_scanned_block" numeric(78, 0),
	"last_scanned_block_hash" char(66),
	"last_safe_block" numeric(78, 0),
	"lease_owner" varchar(120),
	"lease_until" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_code" varchar(120),
	"last_successful_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_reconciliation_cursors_chain_contract_unique" UNIQUE("chain_id","contract_address"),
	CONSTRAINT "chain_reconciliation_cursors_chain_positive" CHECK ("chain_reconciliation_cursors"."chain_id" > 0),
	CONSTRAINT "chain_reconciliation_cursors_contract_normalized" CHECK ("chain_reconciliation_cursors"."contract_address" ~ '^0x[0-9a-f]{40}$' and "chain_reconciliation_cursors"."contract_address" <> '0x0000000000000000000000000000000000000000'),
	CONSTRAINT "chain_reconciliation_cursors_deployment_nonnegative" CHECK ("chain_reconciliation_cursors"."deployment_block" >= 0),
	CONSTRAINT "chain_reconciliation_cursors_confirmation_range" CHECK ("chain_reconciliation_cursors"."confirmation_depth" between 1 and 1024),
	CONSTRAINT "chain_reconciliation_cursors_next_valid" CHECK ("chain_reconciliation_cursors"."next_block" >= "chain_reconciliation_cursors"."deployment_block"),
	CONSTRAINT "chain_reconciliation_cursors_scan_pair" CHECK (("chain_reconciliation_cursors"."last_scanned_block" is null and "chain_reconciliation_cursors"."last_scanned_block_hash" is null) or ("chain_reconciliation_cursors"."last_scanned_block" >= "chain_reconciliation_cursors"."deployment_block" and "chain_reconciliation_cursors"."last_scanned_block_hash" ~ '^0x[0-9a-f]{64}$')),
	CONSTRAINT "chain_reconciliation_cursors_safe_nonnegative" CHECK ("chain_reconciliation_cursors"."last_safe_block" is null or "chain_reconciliation_cursors"."last_safe_block" >= 0),
	CONSTRAINT "chain_reconciliation_cursors_lease_pair" CHECK (("chain_reconciliation_cursors"."lease_owner" is null and "chain_reconciliation_cursors"."lease_until" is null) or ("chain_reconciliation_cursors"."lease_owner" is not null and "chain_reconciliation_cursors"."lease_until" is not null)),
	CONSTRAINT "chain_reconciliation_cursors_failures_nonnegative" CHECK ("chain_reconciliation_cursors"."consecutive_failures" >= 0)
);--> statement-breakpoint
CREATE TABLE "chain_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cursor_id" uuid NOT NULL,
	"merchant_id" uuid,
	"environment_id" uuid,
	"payment_intent_id" uuid,
	"chain_id" numeric(78, 0) NOT NULL,
	"contract_address" char(42) NOT NULL,
	"order_id" char(66) NOT NULL,
	"block_number" numeric(78, 0) NOT NULL,
	"block_hash" char(66) NOT NULL,
	"transaction_hash" char(66) NOT NULL,
	"log_index" integer NOT NULL,
	"event_name" varchar(40) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"payload_hash" char(64) NOT NULL,
	"state" "chain_observation_state" DEFAULT 'canonical' NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"canonical_at" timestamp with time zone NOT NULL,
	"orphaned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_observations_cursor_transaction_log_unique" UNIQUE("cursor_id","transaction_hash","log_index"),
	CONSTRAINT "chain_observations_tenant_consistent" CHECK (("chain_observations"."merchant_id" is null and "chain_observations"."environment_id" is null and "chain_observations"."payment_intent_id" is null) or ("chain_observations"."merchant_id" is not null and "chain_observations"."environment_id" is not null and "chain_observations"."payment_intent_id" is not null)),
	CONSTRAINT "chain_observations_chain_positive" CHECK ("chain_observations"."chain_id" > 0),
	CONSTRAINT "chain_observations_contract_normalized" CHECK ("chain_observations"."contract_address" ~ '^0x[0-9a-f]{40}$' and "chain_observations"."contract_address" <> '0x0000000000000000000000000000000000000000'),
	CONSTRAINT "chain_observations_order_id_format" CHECK ("chain_observations"."order_id" ~ '^0x[0-9a-f]{64}$' and "chain_observations"."order_id" <> ('0x' || repeat('0', 64))),
	CONSTRAINT "chain_observations_block_nonnegative" CHECK ("chain_observations"."block_number" >= 0),
	CONSTRAINT "chain_observations_block_hash_format" CHECK ("chain_observations"."block_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "chain_observations_transaction_hash_format" CHECK ("chain_observations"."transaction_hash" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "chain_observations_log_index_nonnegative" CHECK ("chain_observations"."log_index" >= 0),
	CONSTRAINT "chain_observations_event_not_blank" CHECK (length(btrim("chain_observations"."event_name")) > 0),
	CONSTRAINT "chain_observations_payload_object" CHECK (jsonb_typeof("chain_observations"."payload_json") = 'object'),
	CONSTRAINT "chain_observations_payload_hash_format" CHECK ("chain_observations"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "chain_observations_state_consistent" CHECK (("chain_observations"."state" = 'canonical' and "chain_observations"."orphaned_at" is null) or ("chain_observations"."state" = 'orphaned' and "chain_observations"."orphaned_at" is not null))
);--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cursor_id" uuid NOT NULL,
	"merchant_id" uuid,
	"environment_id" uuid,
	"payment_intent_id" uuid,
	"order_id" char(66),
	"kind" varchar(80) NOT NULL,
	"severity" "reconciliation_issue_severity" DEFAULT 'error' NOT NULL,
	"state" "reconciliation_issue_state" DEFAULT 'open' NOT NULL,
	"canonical_key" char(64) NOT NULL,
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_issues_cursor_kind_key_unique" UNIQUE("cursor_id","kind","canonical_key"),
	CONSTRAINT "reconciliation_issues_tenant_consistent" CHECK (("reconciliation_issues"."merchant_id" is null and "reconciliation_issues"."environment_id" is null and "reconciliation_issues"."payment_intent_id" is null) or ("reconciliation_issues"."merchant_id" is not null and "reconciliation_issues"."environment_id" is not null and "reconciliation_issues"."payment_intent_id" is not null)),
	CONSTRAINT "reconciliation_issues_order_id_format" CHECK ("reconciliation_issues"."order_id" is null or ("reconciliation_issues"."order_id" ~ '^0x[0-9a-f]{64}$' and "reconciliation_issues"."order_id" <> ('0x' || repeat('0', 64)))),
	CONSTRAINT "reconciliation_issues_kind_not_blank" CHECK (length(btrim("reconciliation_issues"."kind")) > 0),
	CONSTRAINT "reconciliation_issues_key_format" CHECK ("reconciliation_issues"."canonical_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "reconciliation_issues_details_object" CHECK (jsonb_typeof("reconciliation_issues"."details_json") = 'object'),
	CONSTRAINT "reconciliation_issues_state_consistent" CHECK (("reconciliation_issues"."state" = 'open' and "reconciliation_issues"."resolved_at" is null) or ("reconciliation_issues"."state" = 'resolved' and "reconciliation_issues"."resolved_at" is not null))
);--> statement-breakpoint
ALTER TABLE "chain_observations" ADD CONSTRAINT "chain_observations_cursor_id_chain_reconciliation_cursors_id_fk" FOREIGN KEY ("cursor_id") REFERENCES "public"."chain_reconciliation_cursors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_observations" ADD CONSTRAINT "chain_observations_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_observations" ADD CONSTRAINT "chain_observations_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_observations" ADD CONSTRAINT "chain_observations_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_observations" ADD CONSTRAINT "chain_observations_intent_owner_fk" FOREIGN KEY ("merchant_id","environment_id","payment_intent_id") REFERENCES "public"."payment_intents"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_cursor_id_chain_reconciliation_cursors_id_fk" FOREIGN KEY ("cursor_id") REFERENCES "public"."chain_reconciliation_cursors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_intent_owner_fk" FOREIGN KEY ("merchant_id","environment_id","payment_intent_id") REFERENCES "public"."payment_intents"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_transaction_evidence" CHECK (("operator_executions"."transaction_hash" is null and "operator_executions"."chain_id" is null and "operator_executions"."last_observed_at" is null) or ("operator_executions"."transaction_hash" ~ '^0x[0-9a-f]{64}$' and "operator_executions"."chain_id" > 0 and "operator_executions"."last_observed_at" is not null));--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_provider_operation_unique" UNIQUE("provider_operation_id");--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_transaction_hash_unique" UNIQUE("transaction_hash");--> statement-breakpoint
CREATE INDEX "chain_reconciliation_cursors_claimable_idx" ON "chain_reconciliation_cursors" USING btree ("lease_until","updated_at");--> statement-breakpoint
CREATE INDEX "chain_observations_order_block_idx" ON "chain_observations" USING btree ("chain_id","contract_address","order_id","block_number","log_index");--> statement-breakpoint
CREATE INDEX "chain_observations_intent_block_idx" ON "chain_observations" USING btree ("payment_intent_id","block_number","log_index");--> statement-breakpoint
CREATE INDEX "chain_observations_state_block_idx" ON "chain_observations" USING btree ("state","block_number");--> statement-breakpoint
CREATE INDEX "reconciliation_issues_tenant_state_idx" ON "reconciliation_issues" USING btree ("merchant_id","environment_id","state","last_observed_at");--> statement-breakpoint
CREATE INDEX "reconciliation_issues_intent_state_idx" ON "reconciliation_issues" USING btree ("payment_intent_id","state","last_observed_at");--> statement-breakpoint
CREATE INDEX "reconciliation_issues_cursor_state_idx" ON "reconciliation_issues" USING btree ("cursor_id","state","last_observed_at");
