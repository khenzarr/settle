CREATE TABLE "merchant_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"key_id" char(22) NOT NULL,
	"prefix" varchar(40) NOT NULL,
	"secret_digest" char(64) NOT NULL,
	"digest_version" integer DEFAULT 1 NOT NULL,
	"scopes_json" jsonb NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_api_keys_key_id_unique" UNIQUE("key_id"),
	CONSTRAINT "merchant_api_keys_environment_prefix_unique" UNIQUE("environment_id","prefix"),
	CONSTRAINT "merchant_api_keys_name_not_blank" CHECK (length(btrim("merchant_api_keys"."name")) > 0),
	CONSTRAINT "merchant_api_keys_key_id_format" CHECK ("merchant_api_keys"."key_id" ~ '^[A-Za-z0-9_-]{22}$'),
	CONSTRAINT "merchant_api_keys_prefix_format" CHECK ("merchant_api_keys"."prefix" ~ '^sk_test_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$'),
	CONSTRAINT "merchant_api_keys_digest_format" CHECK ("merchant_api_keys"."secret_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "merchant_api_keys_digest_version_positive" CHECK ("merchant_api_keys"."digest_version" > 0),
	CONSTRAINT "merchant_api_keys_scopes_array" CHECK (jsonb_typeof("merchant_api_keys"."scopes_json") = 'array' and jsonb_array_length("merchant_api_keys"."scopes_json") between 1 and 16),
	CONSTRAINT "merchant_api_keys_scopes_allowlist" CHECK ("merchant_api_keys"."scopes_json" <@ '["payment_intents:read", "payment_intents:write"]'::jsonb),
	CONSTRAINT "merchant_api_keys_expiry_after_creation" CHECK ("merchant_api_keys"."expires_at" is null or "merchant_api_keys"."expires_at" > "merchant_api_keys"."created_at"),
	CONSTRAINT "merchant_api_keys_revocation_after_creation" CHECK ("merchant_api_keys"."revoked_at" is null or "merchant_api_keys"."revoked_at" >= "merchant_api_keys"."created_at")
);
--> statement-breakpoint
ALTER TABLE "merchant_members" ADD CONSTRAINT "merchant_members_merchant_id_id_unique" UNIQUE("merchant_id","id");--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_environment_owner_fk" FOREIGN KEY ("merchant_id","environment_id") REFERENCES "public"."merchant_environments"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_creator_owner_fk" FOREIGN KEY ("merchant_id","created_by_member_id") REFERENCES "public"."merchant_members"("merchant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "merchant_api_keys_tenant_revoked_idx" ON "merchant_api_keys" USING btree ("merchant_id","environment_id","revoked_at");
