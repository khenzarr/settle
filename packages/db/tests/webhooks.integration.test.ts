import assert from "node:assert/strict";
import test from "node:test";
import { eq, inArray } from "drizzle-orm";

import { createDatabaseClient } from "../src/client.ts";
import { MerchantPaymentIntentService } from "../src/payment-intent-service.ts";
import { auditEvents, idempotencyKeys, merchantEnvironments, merchants, paymentIntentRecipients, paymentIntents, webhookDeliveries, webhookDeliveryAttempts, webhookEndpoints, webhookEvents } from "../src/schema/index.ts";
import { WebhookDeliveryWorker, type WebhookHttpTransport } from "../src/webhook-delivery-worker.ts";
import { canonicalWebhookJson, loadWebhookEncryptionKeySet, verifyWebhookSignatureHeader } from "../src/webhook-security.ts";
import { MerchantWebhookService } from "../src/webhook-service.ts";

class SequenceTransport implements WebhookHttpTransport {
  readonly requests: Array<Readonly<{ url: string; body: string; headers: Readonly<Record<string, string>> }>> = [];
  private readonly statuses: number[];
  constructor(statuses: number[]) { this.statuses = statuses; }
  async post(url: string, body: string, headers: Readonly<Record<string, string>>) {
    this.requests.push({ url, body, headers });
    return { status: this.statuses.shift() ?? 204 };
  }
}

test("webhook endpoints, immutable events, signed retries, and tenant isolation persist atomically", async () => {
  const client = createDatabaseClient(process.env);
  const merchantIds: string[] = [];
  const keys = loadWebhookEncryptionKeySet({ SETTLE_WEBHOOK_ENCRYPTION_KEY_V1: Buffer.alloc(32, 9).toString("base64") });
  try {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const [merchant, otherMerchant] = await client.db.insert(merchants).values([
      { name: "M1.D Webhooks", slug: `m1d-${suffix}`, status: "active" },
      { name: "M1.D Other", slug: `m1d-other-${suffix}`, status: "active" },
    ]).returning({ id: merchants.id });
    assert.ok(merchant && otherMerchant);
    merchantIds.push(merchant.id, otherMerchant.id);
    const [environment, otherEnvironment] = await client.db.insert(merchantEnvironments).values([
      { merchantId: merchant.id, kind: "test", status: "active", displayName: "M1.D" },
      { merchantId: otherMerchant.id, kind: "test", status: "active", displayName: "Other" },
    ]).returning({ id: merchantEnvironments.id, merchantId: merchantEnvironments.merchantId });
    assert.ok(environment && otherEnvironment);
    const tenant = { merchantId: merchant.id, environmentId: environment.id };
    const otherTenant = { merchantId: otherMerchant.id, environmentId: otherEnvironment.id };
    const actor = { ...tenant, apiKeyId: crypto.randomUUID(), requestId: crypto.randomUUID() };
    const service = new MerchantWebhookService(client.db, keys);
    const created = await service.createEndpoint({ ...actor, idempotencyKey: `endpoint-${suffix}`, body: { url: "https://hooks.example.com/settle", description: "Integration", subscriptions: ["payment_intent.created", "payment_intent.funded"] } });
    assert.equal(created.status, 201);
    assert.equal(created.replayed, false);
    const secret = String(created.body.secret);
    assert.match(secret, /^whsec_/);
    const replay = await service.createEndpoint({ ...actor, idempotencyKey: `endpoint-${suffix}`, body: { url: "https://hooks.example.com/settle", description: "Integration", subscriptions: ["payment_intent.created", "payment_intent.funded"] } });
    assert.equal(replay.replayed, true);
    assert.equal(replay.body.secret, null);
    assert.equal((await service.listEndpoints(otherTenant)).data.length, 0);
    const endpointId = String(created.body.id);
    const storedEndpoint = await client.db.query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.id, endpointId) });
    assert.ok(storedEndpoint);
    assert.equal(storedEndpoint.signingSecretCiphertext.includes(secret), false);

    const now = new Date();
    const intent = await new MerchantPaymentIntentService(client.db).create({
      ...actor,
      idempotencyKey: `intent-${suffix}`,
      requestId: crypto.randomUUID(),
      now,
      body: {
        external_order_id: `order-${suffix}`,
        buyer: "0x1111111111111111111111111111111111111111",
        amount: "42.50",
        currency: "USDC",
        funding_deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        settlement_deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settlement_recipients: [{ address: "0x2222222222222222222222222222222222222222", share_bps: 10000 }],
      },
    });
    const intentId = String(intent.body.id);
    const events = await client.db.select().from(webhookEvents).where(eq(webhookEvents.paymentIntentId, intentId));
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "payment_intent.created");
    const deliveries = await client.db.select().from(webhookDeliveries).where(eq(webhookDeliveries.eventId, events[0]!.id));
    assert.equal(deliveries.length, 1);

    const transport = new SequenceTransport([500, 204]);
    const worker = new WebhookDeliveryWorker(client.db, keys, transport);
    const first = await worker.deliverNext(`worker-${suffix}`, now);
    assert.equal(first?.status, "retrying");
    assert.equal(first?.responseStatus, 500);
    assert.equal(transport.requests.length, 1);
    const firstRequest = transport.requests[0]!;
    assert.equal(firstRequest.url, "https://hooks.example.com/settle");
    assert.equal(firstRequest.headers["settle-event-id"], events[0]!.id);
    assert.equal(firstRequest.body, canonicalWebhookJson(events[0]!.payload));
    assert.equal(verifyWebhookSignatureHeader(secret, firstRequest.headers["settle-signature"]!, firstRequest.body, Math.floor(now.getTime() / 1000), 1), true);

    const second = await worker.deliverNext(`worker-${suffix}`, new Date(first!.nextAttemptAt.getTime() + 1));
    assert.equal(second?.status, "delivered");
    assert.equal(second?.responseStatus, 204);
    const attempts = await client.db.select().from(webhookDeliveryAttempts).where(eq(webhookDeliveryAttempts.deliveryId, deliveries[0]!.id));
    assert.deepEqual(attempts.map((attempt) => attempt.outcome), ["retryable_failure", "delivered"]);
    assert.equal((await service.listDeliveries(tenant, endpointId)).data[0]?.status, "delivered");
    await assert.rejects(service.listDeliveries(otherTenant, endpointId), /not found/i);
  } finally {
    if (merchantIds.length) {
      const deliveryRows = await client.db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      if (deliveryRows.length) await client.db.delete(webhookDeliveryAttempts).where(inArray(webhookDeliveryAttempts.deliveryId, deliveryRows.map((row) => row.id)));
      await client.db.delete(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      await client.db.delete(webhookEvents).where(inArray(webhookEvents.merchantId, merchantIds));
      await client.db.delete(webhookEndpoints).where(inArray(webhookEndpoints.merchantId, merchantIds));
      await client.db.delete(auditEvents).where(inArray(auditEvents.merchantId, merchantIds));
      await client.db.delete(idempotencyKeys).where(inArray(idempotencyKeys.merchantId, merchantIds));
      const intentRows = await client.db.select({ id: paymentIntents.id }).from(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      if (intentRows.length) await client.db.delete(paymentIntentRecipients).where(inArray(paymentIntentRecipients.paymentIntentId, intentRows.map((row) => row.id)));
      await client.db.delete(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      await client.db.delete(merchantEnvironments).where(inArray(merchantEnvironments.merchantId, merchantIds));
      await client.db.delete(merchants).where(inArray(merchants.id, merchantIds));
    }
    await client.close();
  }
});
