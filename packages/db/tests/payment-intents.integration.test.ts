import assert from "node:assert/strict";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";

import { createDatabaseClient } from "../src/client.ts";
import { MerchantPaymentIntentError, MerchantPaymentIntentService } from "../src/payment-intent-service.ts";
import { PersistentRateLimitError, PersistentRateLimitService } from "../src/rate-limit-service.ts";
import { apiRateLimitBuckets, auditEvents, idempotencyKeys, merchantEnvironments, merchants, operatorExecutions, paymentIntentRecipients, paymentIntents, webhookDeliveries, webhookDeliveryAttempts, webhookEndpoints, webhookEvents } from "../src/schema/index.ts";

test("Payment Intent creation is atomic, tenant-isolated, replay-safe, rate-limited, and activation only queues", async () => {
  const client = createDatabaseClient(process.env);
  const merchantIds: string[] = [];
  try {
    const suffix = crypto.randomUUID().replaceAll("-", "");
    const [merchant, otherMerchant] = await client.db.insert(merchants).values([
      { name: "M1.C Integration", slug: `m1c-${suffix}`, status: "active" },
      { name: "M1.C Other", slug: `m1c-other-${suffix}`, status: "active" },
    ]).returning({ id: merchants.id });
    assert.ok(merchant && otherMerchant);
    merchantIds.push(merchant.id, otherMerchant.id);
    const [environment, otherEnvironment] = await client.db.insert(merchantEnvironments).values([
      { merchantId: merchant.id, kind: "test", status: "active", displayName: "M1.C" },
      { merchantId: otherMerchant.id, kind: "test", status: "active", displayName: "Other" },
    ]).returning({ id: merchantEnvironments.id, merchantId: merchantEnvironments.merchantId });
    assert.ok(environment && otherEnvironment);
    const tenant = { merchantId: merchant.id, environmentId: environment.id };
    const service = new MerchantPaymentIntentService(client.db);
    const now = new Date();
    const body = {
      external_order_id: `order-${suffix}`,
      buyer: "0x1111111111111111111111111111111111111111",
      amount: "42.50",
      currency: "USDC",
      funding_deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      settlement_deadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      settlement_recipients: [{ address: "0x2222222222222222222222222222222222222222", share_bps: 10000 }],
      metadata: { cart: "integration" },
    };
    const createInput = { ...tenant, apiKeyId: crypto.randomUUID(), idempotencyKey: `create-${suffix}`, body, requestId: crypto.randomUUID(), now };
    const [left, right] = await Promise.all([service.create(createInput), service.create(createInput)]);
    assert.equal(left.status, 201);
    assert.equal(right.status, 201);
    assert.equal(left.body.id, right.body.id);
    assert.equal(left.body.checkout_url, null);
    assert.equal([left.replayed, right.replayed].filter(Boolean).length, 1);
    const intentId = String(left.body.id);
    assert.equal((await client.db.select().from(paymentIntents).where(and(eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.externalOrderId, body.external_order_id)))).length, 1);
    assert.equal((await client.db.select().from(paymentIntentRecipients).where(eq(paymentIntentRecipients.paymentIntentId, intentId))).length, 1);

    await assert.rejects(service.create({ ...createInput, body: { ...body, amount: "43" } }), (error) => error instanceof MerchantPaymentIntentError && error.code === "idempotency_key_reused");
    await assert.rejects(service.create({ ...createInput, idempotencyKey: `other-${suffix}`, body: { ...body, amount: "43" } }), (error) => error instanceof MerchantPaymentIntentError && error.code === "external_order_id_conflict");
    await assert.rejects(service.get({ merchantId: otherMerchant.id, environmentId: otherEnvironment.id }, intentId), (error) => error instanceof MerchantPaymentIntentError && error.code === "payment_intent_not_found");
    assert.equal((await service.list(tenant, { limit: 25 })).data.length, 1);

    const activationInput = { ...tenant, apiKeyId: createInput.apiKeyId, paymentIntentId: intentId, idempotencyKey: `activate-${suffix}`, requestId: crypto.randomUUID(), now };
    const activation = await service.activate(activationInput);
    const activationReplay = await service.activate(activationInput);
    const activationBody = activation.body as { operations: { activation: string }; checkout_url: string | null };
    assert.equal(activation.status, 202);
    assert.equal(activationBody.operations.activation, "queued");
    assert.equal(activationBody.checkout_url, null);
    assert.equal(activationReplay.replayed, true);
    assert.equal((await client.db.select().from(operatorExecutions).where(eq(operatorExecutions.paymentIntentId, intentId))).length, 1);

    const limiter = new PersistentRateLimitService(client.db, "settle-rate-limit-integration-pepper-v1");
    for (let index = 0; index < 10; index += 1) await limiter.consumeRequest({ ...tenant, apiKeyId: `limit-${suffix}`, routeGroup: "payment_intents.activate", now });
    await assert.rejects(limiter.consumeRequest({ ...tenant, apiKeyId: `limit-${suffix}`, routeGroup: "payment_intents.activate", now }), PersistentRateLimitError);
  } finally {
    if (merchantIds.length) {
      await client.db.delete(apiRateLimitBuckets).where(inArray(apiRateLimitBuckets.merchantId, merchantIds));
      const deliveries = await client.db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      if (deliveries.length) await client.db.delete(webhookDeliveryAttempts).where(inArray(webhookDeliveryAttempts.deliveryId, deliveries.map((row) => row.id)));
      await client.db.delete(webhookDeliveries).where(inArray(webhookDeliveries.merchantId, merchantIds));
      await client.db.delete(webhookEvents).where(inArray(webhookEvents.merchantId, merchantIds));
      await client.db.delete(webhookEndpoints).where(inArray(webhookEndpoints.merchantId, merchantIds));
      await client.db.delete(auditEvents).where(inArray(auditEvents.merchantId, merchantIds));
      await client.db.delete(idempotencyKeys).where(inArray(idempotencyKeys.merchantId, merchantIds));
      await client.db.delete(operatorExecutions).where(inArray(operatorExecutions.merchantId, merchantIds));
      const owned = await client.db.select({ id: paymentIntents.id }).from(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      if (owned.length) await client.db.delete(paymentIntentRecipients).where(inArray(paymentIntentRecipients.paymentIntentId, owned.map((row) => row.id)));
      await client.db.delete(paymentIntents).where(inArray(paymentIntents.merchantId, merchantIds));
      await client.db.delete(merchantEnvironments).where(inArray(merchantEnvironments.merchantId, merchantIds));
      await client.db.delete(merchants).where(inArray(merchants.id, merchantIds));
    }
    await client.close();
  }
});
