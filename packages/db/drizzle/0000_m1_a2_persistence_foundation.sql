CREATE TYPE "public"."audit_actor_type" AS ENUM('system', 'merchant_member', 'merchant_api_key', 'worker');--> statement-breakpoint
CREATE TYPE "public"."canonical_order_status" AS ENUM('none', 'created', 'funded', 'disputed', 'completed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."chain_verification_state" AS ENUM('unverified', 'verified', 'stale', 'error');--> statement-breakpoint
CREATE TYPE "public"."idempotency_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."merchant_environment_kind" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."merchant_environment_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."merchant_member_role" AS ENUM('owner', 'admin', 'developer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."merchant_member_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."merchant_status" AS ENUM('pending', 'active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_state" AS ENUM('planned', 'awaiting_activation', 'awaiting_payment', 'payment_window_expired', 'funded', 'disputed', 'completed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid,
	"environment_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_subject" varchar(255) NOT NULL,
	"action" varchar(120) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" varchar(160),
	"request_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_tenant_pair" CHECK (("audit_events"."merchant_id" is null and "audit_events"."environment_id" is null) or "audit_events"."merchant_id" is not null),
	CONSTRAINT "audit_events_actor_not_blank" CHECK (length(btrim("audit_events"."actor_subject")) > 0),
	CONSTRAINT "audit_events_action_not_blank" CHECK (length(btrim("audit_events"."action")) > 0),
	CONSTRAINT "audit_events_resource_type_not_blank" CHECK (length(btrim("audit_events"."resource_type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"key_digest" char(64) NOT NULL,
	"request_fingerprint" char(64) NOT NULL,
	"resource_type" varchar(80) NOT NULL,
	"resource_id" varchar(160),
	"response_status" integer,
	"response_body_json" jsonb,
	"status" "idempotency_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_tenant_key_unique" UNIQUE("merchant_id","environment_id","key_digest"),
	CONSTRAINT "idempotency_keys_digest_format" CHECK ("idempotency_keys"."key_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "idempotency_keys_fingerprint_format" CHECK ("idempotency_keys"."request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "idempotency_keys_resource_type_not_blank" CHECK (length(btrim("idempotency_keys"."resource_type")) > 0),
	CONSTRAINT "idempotency_keys_expiry_after_creation" CHECK ("idempotency_keys"."expires_at" > "idempotency_keys"."created_at"),
	CONSTRAINT "idempotency_keys_response_status" CHECK ("idempotency_keys"."response_status" is null or "idempotency_keys"."response_status" between 100 and 599)
);
--> statement-breakpoint
CREATE TABLE "merchant_environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"kind" "merchant_environment_kind" NOT NULL,
	"status" "merchant_environment_status" DEFAULT 'active' NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"checkout_origin" text,
	"settings_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_environments_merchant_kind_unique" UNIQUE("merchant_id","kind"),
	CONSTRAINT "merchant_environments_merchant_id_id_unique" UNIQUE("merchant_id","id"),
	CONSTRAINT "merchant_environments_display_name_not_blank" CHECK (length(btrim("merchant_environments"."display_name")) > 0),
	CONSTRAINT "merchant_environments_checkout_origin" CHECK ("merchant_environments"."checkout_origin" is null or "merchant_environments"."checkout_origin" ~ '^https://[^/[:space:]]+(?::[0-9]+)?$')
);
--> statement-breakpoint
CREATE TABLE "merchant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"role" "merchant_member_role" NOT NULL,
	"status" "merchant_member_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_members_provider_subject_merchant_unique" UNIQUE("provider","subject","merchant_id"),
	CONSTRAINT "merchant_members_provider_not_blank" CHECK (length(btrim("merchant_members"."provider")) > 0),
	CONSTRAINT "merchant_members_subject_not_blank" CHECK (length(btrim("merchant_members"."subject")) > 0)
);
--> statement-breakpoint
CREATE TABLE "merchant_settings" (
	"merchant_id" uuid PRIMARY KEY NOT NULL,
	"statement_descriptor" varchar(22),
	"support_email" varchar(320),
	"default_webhook_tolerance_seconds" integer DEFAULT 300 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_settings_webhook_tolerance_range" CHECK ("merchant_settings"."default_webhook_tolerance_seconds" between 60 and 900),
	CONSTRAINT "merchant_settings_version_positive" CHECK ("merchant_settings"."version" > 0),
	CONSTRAINT "merchant_settings_descriptor_safe" CHECK ("merchant_settings"."statement_descriptor" is null or "merchant_settings"."statement_descriptor" ~ '^[A-Za-z0-9 ._-]{1,22}$')
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"status" "merchant_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug"),
	CONSTRAINT "merchants_name_not_blank" CHECK (length(btrim("merchants"."name")) > 0),
	CONSTRAINT "merchants_slug_format" CHECK ("merchants"."slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "chain_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"chain_id" numeric(78, 0) NOT NULL,
	"contract_address" char(42) NOT NULL,
	"order_id" char(66) NOT NULL,
	"terms_hash" char(66) NOT NULL,
	"canonical_status" "canonical_order_status" DEFAULT 'none' NOT NULL,
	"last_verified_block" numeric(78, 0),
	"last_verified_block_hash" char(66),
	"last_verified_payload_hash" char(66),
	"verification_state" "chain_verification_state" DEFAULT 'unverified' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chain_orders_payment_intent_unique" UNIQUE("payment_intent_id"),
	CONSTRAINT "chain_orders_chain_contract_order_unique" UNIQUE("chain_id","contract_address","order_id"),
	CONSTRAINT "chain_orders_chain_id_positive" CHECK ("chain_orders"."chain_id" > 0),
	CONSTRAINT "chain_orders_contract_normalized" CHECK ("chain_orders"."contract_address" ~ '^0x[0-9a-f]{40}$' and "chain_orders"."contract_address" <> '0x0000000000000000000000000000000000000000'),
	CONSTRAINT "chain_orders_order_id_format" CHECK ("chain_orders"."order_id" ~ '^0x[0-9a-f]{64}$' and "chain_orders"."order_id" <> ('0x' || repeat('0', 64))),
	CONSTRAINT "chain_orders_terms_hash_format" CHECK ("chain_orders"."terms_hash" ~ '^0x[0-9a-f]{64}$' and "chain_orders"."terms_hash" <> ('0x' || repeat('0', 64))),
	CONSTRAINT "chain_orders_verification_consistent" CHECK (("chain_orders"."canonical_status" = 'none' and "chain_orders"."last_verified_at" is null) or ("chain_orders"."canonical_status" <> 'none' and "chain_orders"."last_verified_at" is not null)),
	CONSTRAINT "chain_orders_block_evidence_pair" CHECK (("chain_orders"."last_verified_block" is null and "chain_orders"."last_verified_block_hash" is null) or ("chain_orders"."last_verified_block" >= 0 and "chain_orders"."last_verified_block_hash" ~ '^0x[0-9a-f]{64}$')),
	CONSTRAINT "chain_orders_payload_hash_format" CHECK ("chain_orders"."last_verified_payload_hash" is null or "chain_orders"."last_verified_payload_hash" ~ '^0x[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "payment_intent_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_intent_id" uuid NOT NULL,
	"recipient_address" char(42) NOT NULL,
	"share_bps" smallint NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intent_recipients_position_unique" UNIQUE("payment_intent_id","position"),
	CONSTRAINT "payment_intent_recipients_address_unique" UNIQUE("payment_intent_id","recipient_address"),
	CONSTRAINT "payment_intent_recipients_share_range" CHECK ("payment_intent_recipients"."share_bps" between 1 and 10000),
	CONSTRAINT "payment_intent_recipients_position_range" CHECK ("payment_intent_recipients"."position" between 0 and 7),
	CONSTRAINT "payment_intent_recipients_address_normalized" CHECK ("payment_intent_recipients"."recipient_address" ~ '^0x[0-9a-f]{40}$' and "payment_intent_recipients"."recipient_address" <> '0x0000000000000000000000000000000000000000')
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"external_order_id" varchar(128) NOT NULL,
	"buyer_address" char(42) NOT NULL,
	"currency" char(4) DEFAULT 'USDC' NOT NULL,
	"amount_base_units" numeric(78, 0) NOT NULL,
	"funding_deadline" timestamp with time zone NOT NULL,
	"settlement_deadline" timestamp with time zone NOT NULL,
	"application_state" "payment_intent_state" DEFAULT 'planned' NOT NULL,
	"canonical_status" "canonical_order_status" DEFAULT 'none' NOT NULL,
	"canonical_observed_at" timestamp with time zone,
	"reconciliation_state" varchar(40) DEFAULT 'unobserved' NOT NULL,
	"activated_at" timestamp with time zone,
	"funded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"order_id" char(66) NOT NULL,
	"terms_hash" char(66) NOT NULL,
	"checkout_path" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_merchant_environment_id_unique" UNIQUE("merchant_id","environment_id","id"),
	CONSTRAINT "payment_intents_external_order_unique" UNIQUE("merchant_id","environment_id","external_order_id"),
	CONSTRAINT "payment_intents_environment_order_id_unique" UNIQUE("environment_id","order_id"),
	CONSTRAINT "payment_intents_amount_positive" CHECK ("payment_intents"."amount_base_units" > 0),
	CONSTRAINT "payment_intents_currency_usdc" CHECK ("payment_intents"."currency" = 'USDC'),
	CONSTRAINT "payment_intents_deadline_order" CHECK ("payment_intents"."settlement_deadline" > "payment_intents"."funding_deadline"),
	CONSTRAINT "payment_intents_external_order_not_blank" CHECK (length(btrim("payment_intents"."external_order_id")) > 0),
	CONSTRAINT "payment_intents_buyer_normalized" CHECK ("payment_intents"."buyer_address" ~ '^0x[0-9a-f]{40}$' and "payment_intents"."buyer_address" <> '0x0000000000000000000000000000000000000000'),
	CONSTRAINT "payment_intents_order_id_format" CHECK ("payment_intents"."order_id" ~ '^0x[0-9a-f]{64}$' and "payment_intents"."order_id" <> ('0x' || repeat('0', 64))),
	CONSTRAINT "payment_intents_terms_hash_format" CHECK ("payment_intents"."terms_hash" ~ '^0x[0-9a-f]{64}$' and "payment_intents"."terms_hash" <> ('0x' || repeat('0', 64))),
	CONSTRAINT "payment_intents_checkout_path_safe" CHECK ("payment_intents"."checkout_path" is null or ("payment_intents"."checkout_path" like '/pay/%' and length("payment_intents"."checkout_path") <= 256)),
	CONSTRAINT "payment_intents_observation_consistent" CHECK (("payment_intents"."canonical_status" = 'none' and "payment_intents"."canonical_observed_at" is null) or ("payment_intents"."canonical_status" <> 'none' and "payment_intents"."canonical_observed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_environments" ADD CONSTRAINT "merchant_environments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_settings" ADD CONSTRAINT "merchant_settings_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chain_orders" ADD CONSTRAINT "chain_orders_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intent_recipients" ADD CONSTRAINT "payment_intent_recipients_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_merchant_created_idx" ON "audit_events" USING btree ("merchant_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_created_idx" ON "audit_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_action_created_idx" ON "audit_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expiry_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idempotency_keys_tenant_resource_idx" ON "idempotency_keys" USING btree ("merchant_id","environment_id","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "merchant_environments_merchant_status_idx" ON "merchant_environments" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "merchant_members_merchant_status_idx" ON "merchant_members" USING btree ("merchant_id","status");--> statement-breakpoint
CREATE INDEX "merchants_status_created_at_idx" ON "merchants" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "chain_orders_verification_state_idx" ON "chain_orders" USING btree ("verification_state","last_verified_at");--> statement-breakpoint
CREATE INDEX "payment_intent_recipients_intent_idx" ON "payment_intent_recipients" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_intents_tenant_created_idx" ON "payment_intents" USING btree ("merchant_id","environment_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_intents_tenant_state_idx" ON "payment_intents" USING btree ("merchant_id","environment_id","application_state");--> statement-breakpoint
CREATE INDEX "payment_intents_canonical_observed_idx" ON "payment_intents" USING btree ("canonical_status","canonical_observed_at");