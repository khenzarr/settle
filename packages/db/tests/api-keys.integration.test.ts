import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import { MerchantApiKeyAuthError, MerchantApiKeyService } from "../src/api-key-service.ts";
import { loadApiKeyPepperSet } from "../src/api-keys.ts";
import { createDatabaseClient } from "../src/client.ts";
import { auditEvents, merchantApiKeys, merchantEnvironments, merchantMembers, merchants } from "../src/schema/index.ts";

const rollbackSentinel = new Error("ROLLBACK_API_KEY_INTEGRATION");
const testPeppers = loadApiKeyPepperSet({ SETTLE_API_KEY_PEPPER_V1: "settle-integration-pepper-that-is-at-least-32-bytes" });

test("test API key lifecycle is tenant-scoped, non-recoverable, audited, and immediately revocable", async () => {
  const client = createDatabaseClient(process.env);
  try {
    await assert.rejects(client.db.transaction(async (tx) => {
      const suffix = crypto.randomUUID().replaceAll("-", "");
      const [merchant] = await tx.insert(merchants).values({ name: "API Key Integration", slug: `api-key-${suffix}`, status: "active" }).returning({ id: merchants.id });
      assert.ok(merchant);
      const [member] = await tx.insert(merchantMembers).values({ merchantId: merchant.id, provider: "test", subject: `subject-${suffix}`, role: "owner", status: "active" }).returning({ id: merchantMembers.id });
      const [environment] = await tx.insert(merchantEnvironments).values({ merchantId: merchant.id, kind: "test", status: "active", displayName: "Integration" }).returning({ id: merchantEnvironments.id });
      assert.ok(member && environment);

      const tenant = { merchantId: merchant.id, environmentId: environment.id };
      const service = new MerchantApiKeyService(tx, testPeppers);
      const issued = await service.issueTestKey({
        ...tenant,
        name: "Integration read key",
        scopes: ["payment_intents:read"],
        expiresAt: new Date(Date.now() + 86_400_000),
        createdByMemberId: member.id,
        actor: { type: "merchant_member", subject: member.id },
      });

      assert.match(issued.plaintext, /^sk_test_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{43}$/);
      const stored = await tx.query.merchantApiKeys.findFirst({ where: eq(merchantApiKeys.id, issued.id) });
      assert.ok(stored);
      assert.notEqual(stored.secretDigest, issued.plaintext);
      assert.equal(JSON.stringify(stored).includes(issued.plaintext), false);

      const authenticated = await service.authenticateAuthorizationHeader(`Bearer ${issued.plaintext}`, "payment_intents:read");
      assert.deepEqual({ merchantId: authenticated.merchantId, environmentId: authenticated.environmentId, apiKeyId: authenticated.apiKeyId }, { ...tenant, apiKeyId: issued.id });
      const used = await tx.query.merchantApiKeys.findFirst({ where: eq(merchantApiKeys.id, issued.id) });
      assert.ok(used?.lastUsedAt);

      const listed = await service.listTestKeys(tenant);
      assert.equal(listed.length, 1);
      assert.equal("secretDigest" in listed[0]!, false);
      assert.equal("plaintext" in listed[0]!, false);

      await assert.rejects(service.authenticateAuthorizationHeader(`Bearer ${issued.plaintext}`, "payment_intents:write"), (error) => error instanceof MerchantApiKeyAuthError && error.code === "insufficient_scope" && error.status === 403);
      const replacement = issued.plaintext.endsWith("A") ? "B" : "A";
      const altered = `${issued.plaintext.slice(0, -1)}${replacement}`;
      await assert.rejects(service.authenticateAuthorizationHeader(`Bearer ${altered}`, "payment_intents:read"), (error) => error instanceof MerchantApiKeyAuthError && error.code === "invalid_api_key" && error.status === 401);

      const [otherMerchant] = await tx.insert(merchants).values({ name: "Other Tenant", slug: `other-${suffix}`, status: "active" }).returning({ id: merchants.id });
      assert.ok(otherMerchant);
      const [otherEnvironment] = await tx.insert(merchantEnvironments).values({ merchantId: otherMerchant.id, kind: "test", status: "active", displayName: "Other" }).returning({ id: merchantEnvironments.id });
      assert.ok(otherEnvironment);
      assert.equal(await service.revokeTestKey({ merchantId: otherMerchant.id, environmentId: otherEnvironment.id, apiKeyId: issued.id, actor: { type: "system", subject: "integration-test" } }), undefined);

      const revoked = await service.revokeTestKey({ ...tenant, apiKeyId: issued.id, actor: { type: "merchant_member", subject: member.id } });
      assert.equal(revoked?.id, issued.id);
      await assert.rejects(service.authenticateAuthorizationHeader(`Bearer ${issued.plaintext}`, "payment_intents:read"), (error) => error instanceof MerchantApiKeyAuthError && error.code === "invalid_api_key");

      const audit = await tx.select({ action: auditEvents.action }).from(auditEvents).where(and(eq(auditEvents.merchantId, merchant.id), eq(auditEvents.resourceId, issued.id)));
      assert.deepEqual(audit.map((event) => event.action).sort(), ["merchant.api_key.created", "merchant.api_key.revoked"]);
      throw rollbackSentinel;
    }), (error) => error === rollbackSentinel);
  } finally {
    await client.close();
  }
});
