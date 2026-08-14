CREATE TYPE "public"."operator_execution_state" AS ENUM('queued', 'submitted', 'succeeded', 'failed', 'ambiguous');--> statement-breakpoint
CREATE TYPE "public"."rate_limit_dimension" AS ENUM('api_key', 'merchant', 'ip');--> statement-breakpoint
CREATE TABLE "operator_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"operation" varchar(40) NOT NULL,
	"state" "operator_execution_state" DEFAULT 'queued' NOT NULL,
	"provider_idempotency_digest" char(64) NOT NULL,
	"requested_by_subject" varchar(160) NOT NULL,
	"failure_code" varchar(120),
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_executions_intent_operation_unique" UNIQUE("payment_intent_id","operation"),
	CONSTRAINT "operator_executions_provider_digest_unique" UNIQUE("provider_idempotency_digest"),
	CONSTRAINT "operator_executions_operation_activation" CHECK ("operator_executions"."operation" = 'activation'),
	CONSTRAINT "operator_executions_digest_format" CHECK ("operator_executions"."provider_idempotency_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "operator_executions_subject_not_blank" CHECK (length(btrim("operator_executions"."requested_by_subject")) > 0)
);
--> statement-breakpoint
CREATE TABLE "api_rate_limit_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"dimension" "rate_limit_dimension" NOT NULL,
	"subject_digest" char(64) NOT NULL,
	"route_group" varchar(80) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_seconds" integer NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_rate_limit_buckets_identity_unique" UNIQUE("merchant_id","environment_id","dimension","subject_digest","route_group","window_start"),
	CONSTRAINT "api_rate_limit_buckets_digest_format" CHECK ("api_rate_limit_buckets"."subject_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "api_rate_limit_buckets_route_not_blank" CHECK (length(btrim("api_rate_limit_buckets"."route_group")) > 0),
	CONSTRAINT "api_rate_limit_buckets_window_range" CHECK ("api_rate_limit_buckets"."window_seconds" between 1 and 3600),
	CONSTRAINT "api_rate_limit_buckets_count_positive" CHECK ("api_rate_limit_buckets"."request_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_executions" ADD CONSTRAINT "operator_executions_intent_owner_fk" FOREIGN KEY ("merchant_id","environment_id","payment_intent_id") REFERENCES "public"."payment_intents"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_rate_limit_buckets" ADD CONSTRAINT "api_rate_limit_buckets_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_rate_limit_buckets" ADD CONSTRAINT "api_rate_limit_buckets_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operator_executions_tenant_state_idx" ON "operator_executions" USING btree ("merchant_id","environment_id","state","created_at");--> statement-breakpoint
CREATE INDEX "api_rate_limit_buckets_expiry_idx" ON "api_rate_limit_buckets" USING btree ("window_start","window_seconds");--> statement-breakpoint
CREATE INDEX "api_rate_limit_buckets_tenant_route_idx" ON "api_rate_limit_buckets" USING btree ("merchant_id","environment_id","route_group","window_start");