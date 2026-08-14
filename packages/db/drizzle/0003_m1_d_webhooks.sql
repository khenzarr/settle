CREATE TYPE "public"."webhook_endpoint_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'delivering', 'delivered', 'retrying', 'exhausted', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."webhook_attempt_outcome" AS ENUM('delivered', 'retryable_failure', 'terminal_failure');--> statement-breakpoint
ALTER TABLE "merchant_api_keys" DROP CONSTRAINT "merchant_api_keys_scopes_allowlist";--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_scopes_allowlist" CHECK ("merchant_api_keys"."scopes_json" <@ '["payment_intents:read", "payment_intents:write", "webhook_endpoints:read", "webhook_endpoints:write"]'::jsonb);--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"url" text NOT NULL,
	"description" varchar(160),
	"signing_secret_ciphertext" text NOT NULL,
	"secret_version" integer DEFAULT 1 NOT NULL,
	"status" "webhook_endpoint_status" DEFAULT 'active' NOT NULL,
	"subscriptions" jsonb NOT NULL,
	"last_success_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_environment_url_unique" UNIQUE("environment_id","url"),
	CONSTRAINT "webhook_endpoints_tenant_id_unique" UNIQUE("merchant_id","environment_id","id"),
	CONSTRAINT "webhook_endpoints_https_url" CHECK ("webhook_endpoints"."url" ~ '^https://[^/[:space:]]+(?::443)?(?:/[^[:space:]]*)?$' and length("webhook_endpoints"."url") <= 2048),
	CONSTRAINT "webhook_endpoints_description_not_blank" CHECK ("webhook_endpoints"."description" is null or length(btrim("webhook_endpoints"."description")) > 0),
	CONSTRAINT "webhook_endpoints_ciphertext_not_blank" CHECK (length("webhook_endpoints"."signing_secret_ciphertext") between 32 and 4096),
	CONSTRAINT "webhook_endpoints_secret_version_positive" CHECK ("webhook_endpoints"."secret_version" > 0),
	CONSTRAINT "webhook_endpoints_subscriptions_array" CHECK (jsonb_typeof("webhook_endpoints"."subscriptions") = 'array' and jsonb_array_length("webhook_endpoints"."subscriptions") between 1 and 16)
);--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"payment_intent_id" uuid,
	"type" varchar(100) NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"payload_json" jsonb NOT NULL,
	"payload_hash" char(64) NOT NULL,
	"canonical_event_key" varchar(160) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("id"),
	CONSTRAINT "webhook_events_tenant_id_unique" UNIQUE("merchant_id","environment_id","id"),
	CONSTRAINT "webhook_events_intent_semantic_unique" UNIQUE("payment_intent_id","type","canonical_event_key"),
	CONSTRAINT "webhook_events_type_not_blank" CHECK (length(btrim("webhook_events"."type")) > 0),
	CONSTRAINT "webhook_events_schema_version_positive" CHECK ("webhook_events"."schema_version" > 0),
	CONSTRAINT "webhook_events_payload_object" CHECK (jsonb_typeof("webhook_events"."payload_json") = 'object'),
	CONSTRAINT "webhook_events_payload_hash_format" CHECK ("webhook_events"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "webhook_events_canonical_key_not_blank" CHECK (length(btrim("webhook_events"."canonical_event_key")) > 0)
);--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"response_status" integer,
	"response_code" varchar(120),
	"request_signature_version" integer,
	"delivered_at" timestamp with time zone,
	"lease_owner" varchar(120),
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_event_endpoint_unique" UNIQUE("event_id","endpoint_id"),
	CONSTRAINT "webhook_deliveries_tenant_id_unique" UNIQUE("merchant_id","environment_id","id"),
	CONSTRAINT "webhook_deliveries_attempt_count_nonnegative" CHECK ("webhook_deliveries"."attempt_count" >= 0),
	CONSTRAINT "webhook_deliveries_response_status" CHECK ("webhook_deliveries"."response_status" is null or "webhook_deliveries"."response_status" between 100 and 599),
	CONSTRAINT "webhook_deliveries_signature_version_positive" CHECK ("webhook_deliveries"."request_signature_version" is null or "webhook_deliveries"."request_signature_version" > 0),
	CONSTRAINT "webhook_deliveries_delivery_consistent" CHECK (("webhook_deliveries"."status" = 'delivered' and "webhook_deliveries"."delivered_at" is not null) or ("webhook_deliveries"."status" <> 'delivered' and "webhook_deliveries"."delivered_at" is null)),
	CONSTRAINT "webhook_deliveries_lease_pair" CHECK (("webhook_deliveries"."lease_owner" is null and "webhook_deliveries"."lease_until" is null) or ("webhook_deliveries"."lease_owner" is not null and "webhook_deliveries"."lease_until" is not null))
);--> statement-breakpoint
CREATE TABLE "webhook_delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"outcome" "webhook_attempt_outcome" NOT NULL,
	"response_status" integer,
	"failure_code" varchar(120),
	"duration_ms" integer NOT NULL,
	"signature_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_delivery_attempts_delivery_number_unique" UNIQUE("delivery_id","attempt_number"),
	CONSTRAINT "webhook_delivery_attempts_number_positive" CHECK ("webhook_delivery_attempts"."attempt_number" > 0),
	CONSTRAINT "webhook_delivery_attempts_time_order" CHECK ("webhook_delivery_attempts"."finished_at" >= "webhook_delivery_attempts"."started_at"),
	CONSTRAINT "webhook_delivery_attempts_response_status" CHECK ("webhook_delivery_attempts"."response_status" is null or "webhook_delivery_attempts"."response_status" between 100 and 599),
	CONSTRAINT "webhook_delivery_attempts_duration_nonnegative" CHECK ("webhook_delivery_attempts"."duration_ms" >= 0),
	CONSTRAINT "webhook_delivery_attempts_signature_version_positive" CHECK ("webhook_delivery_attempts"."signature_version" > 0)
);--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_intent_owner_fk" FOREIGN KEY ("merchant_id","environment_id","payment_intent_id") REFERENCES "public"."payment_intents"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."webhook_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_owner_fk" FOREIGN KEY ("merchant_id","environment_id","event_id") REFERENCES "public"."webhook_events"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_owner_fk" FOREIGN KEY ("merchant_id","environment_id","endpoint_id") REFERENCES "public"."webhook_endpoints"("merchant_id","environment_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_delivery_id_webhook_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."webhook_deliveries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_endpoints_tenant_status_idx" ON "webhook_endpoints" USING btree ("merchant_id","environment_id","status","created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_tenant_created_idx" ON "webhook_events" USING btree ("merchant_id","environment_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_intent_created_idx" ON "webhook_events" USING btree ("payment_intent_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_claimable_idx" ON "webhook_deliveries" USING btree ("status","next_attempt_at","lease_until");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_created_idx" ON "webhook_deliveries" USING btree ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_delivery_created_idx" ON "webhook_delivery_attempts" USING btree ("delivery_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_delivery_attempts_outcome_created_idx" ON "webhook_delivery_attempts" USING btree ("outcome","created_at");
