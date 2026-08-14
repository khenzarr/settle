import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";

import type { SettleDatabase } from "./client.ts";
import { AuditRepository, IdempotencyRepository } from "./repositories/index.ts";
import { webhookDeliveries, webhookEndpoints, webhookEvents } from "./schema/index.ts";
import type { DatabaseExecutor, SettleTransaction } from "./transaction.ts";
import type { TenantContext } from "./types.ts";
import {
  canonicalWebhookJson,
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
  validateWebhookEndpointUrl,
  validateWebhookSubscriptions,
  webhookPayloadHash,
  type WebhookEncryptionKeySet,
  type WebhookEventType,
} from "./webhook-security.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export class MerchantWebhookError extends Error {
  readonly status: 400 | 404 | 409 | 500;
  readonly code: string;
  readonly param?: string;
  constructor(status: MerchantWebhookError["status"], code: string, message: string, param?: string) {
    super(message);
    this.name = "MerchantWebhookError";
    this.status = status;
    this.code = code;
    this.param = param;
  }
}

type WebhookActorInput = TenantContext & Readonly<{
  apiKeyId: string;
  requestId: string;
  idempotencyKey: string;
  now?: Date;
}>;

type IdempotencyClaim = Awaited<ReturnType<IdempotencyRepository["claim"]>>;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

function validateIdempotencyKey(value: string): string {
  if (!value || value.length > 255 || !/^[\x21-\x7e]+$/.test(value)) throw new MerchantWebhookError(400, "invalid_idempotency_key", "Idempotency-Key must contain 1 to 255 printable characters", "Idempotency-Key");
  return value;
}

async function claimOrReplay(tx: SettleTransaction, tenant: TenantContext, input: Readonly<{ key: string; fingerprint: string; resourceType: string; now: Date }>): Promise<{ kind: "new"; claim: NonNullable<IdempotencyClaim> } | { kind: "replay"; status: number; body: Record<string, unknown> }> {
  const repository = new IdempotencyRepository(tx);
  const keyDigest = sha256(input.key);
  const claim = await repository.claim(tenant, { keyDigest, requestFingerprint: input.fingerprint, resourceType: input.resourceType, expiresAt: new Date(input.now.getTime() + IDEMPOTENCY_TTL_MS) });
  if (claim) return { kind: "new", claim };
  const existing = await repository.findForUpdate(tenant, keyDigest);
  if (!existing) throw new MerchantWebhookError(500, "idempotency_state_unavailable", "Idempotency state is temporarily unavailable");
  if (existing.requestFingerprint !== input.fingerprint) throw new MerchantWebhookError(409, "idempotency_key_reused", "Idempotency-Key was already used with a different request");
  if (existing.status === "completed" && existing.responseStatus && existing.responseBody) return { kind: "replay", status: existing.responseStatus, body: existing.responseBody };
  throw new MerchantWebhookError(409, "request_in_progress", "An identical request is already being processed");
}

function strictObject(value: unknown, allowed: readonly string[], name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MerchantWebhookError(400, `invalid_${name}`, `${name} must be a JSON object`);
  const record = value as Record<string, unknown>;
  const extra = Object.keys(record).find((key) => !allowed.includes(key));
  if (extra) throw new MerchantWebhookError(400, `invalid_${name}`, `${extra} is not an accepted field`, extra);
  return record;
}

function normalizeDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new MerchantWebhookError(400, "invalid_description", "description must be a string", "description");
  const description = value.trim();
  if (!description || description.length > 160 || /\p{Cc}/u.test(description)) throw new MerchantWebhookError(400, "invalid_description", "description must contain 1 to 160 safe characters", "description");
  return description;
}

function endpointProjection(record: typeof webhookEndpoints.$inferSelect) {
  return {
    id: record.id,
    url: record.url,
    description: record.description,
    status: record.status,
    subscriptions: record.subscriptions,
    secret_version: record.secretVersion,
    last_success_at: record.lastSuccessAt?.toISOString() ?? null,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

function requireUuid(value: string, code: string): string {
  if (!UUID_PATTERN.test(value)) throw new MerchantWebhookError(404, code, "Resource not found");
  return value;
}

export async function emitPaymentIntentWebhookEvent(db: DatabaseExecutor, input: TenantContext & Readonly<{
  paymentIntentId: string;
  type: Exclude<WebhookEventType, "webhook_endpoint.test">;
  canonicalEventKey: string;
  resource: Record<string, unknown>;
  occurredAt: Date;
}>) {
  const existing = await db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.paymentIntentId, input.paymentIntentId), eq(webhookEvents.type, input.type), eq(webhookEvents.canonicalEventKey, input.canonicalEventKey)) });
  let event = existing;
  if (!event) {
    const eventId = randomUUID();
    const payload = {
      id: eventId,
      type: input.type,
      version: 1,
      created: input.occurredAt.toISOString(),
      environment: "test",
      data: { object: input.resource },
    };
    const rawBody = canonicalWebhookJson(payload);
    [event] = await db.insert(webhookEvents).values({
      id: eventId,
      merchantId: input.merchantId,
      environmentId: input.environmentId,
      paymentIntentId: input.paymentIntentId,
      type: input.type,
      schemaVersion: 1,
      payload,
      payloadHash: webhookPayloadHash(rawBody),
      canonicalEventKey: input.canonicalEventKey,
      occurredAt: input.occurredAt,
    }).onConflictDoNothing().returning();
    if (!event) event = await db.query.webhookEvents.findFirst({ where: and(eq(webhookEvents.paymentIntentId, input.paymentIntentId), eq(webhookEvents.type, input.type), eq(webhookEvents.canonicalEventKey, input.canonicalEventKey)) });
  }
  if (!event) throw new MerchantWebhookError(500, "webhook_event_unavailable", "Webhook event could not be persisted");
  const endpoints = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints).where(and(
    eq(webhookEndpoints.merchantId, input.merchantId),
    eq(webhookEndpoints.environmentId, input.environmentId),
    eq(webhookEndpoints.status, "active"),
    sql`${webhookEndpoints.subscriptions} @> ${JSON.stringify([input.type])}::jsonb`,
  ));
  if (endpoints.length) {
    await db.insert(webhookDeliveries).values(endpoints.map((endpoint) => ({ ...input, eventId: event!.id, endpointId: endpoint.id, status: "pending" as const, nextAttemptAt: input.occurredAt }))).onConflictDoNothing();
  }
  return { eventId: event.id, deliveryCount: endpoints.length } as const;
}

export class MerchantWebhookService {
  private readonly db: SettleDatabase;
  private readonly keys: WebhookEncryptionKeySet;
  constructor(db: SettleDatabase, keys: WebhookEncryptionKeySet) {
    this.db = db;
    this.keys = keys;
  }

  async createEndpoint(input: WebhookActorInput & Readonly<{ body: unknown }>) {
    const now = input.now ?? new Date();
    const body = strictObject(input.body, ["url", "description", "subscriptions"], "webhook_endpoint");
    let url: string;
    let subscriptions: readonly WebhookEventType[];
    try { url = validateWebhookEndpointUrl(body.url); }
    catch (cause) { throw new MerchantWebhookError(400, "invalid_webhook_url", cause instanceof Error ? cause.message : "Webhook URL is invalid", "url"); }
    try { subscriptions = validateWebhookSubscriptions(body.subscriptions); }
    catch (cause) { throw new MerchantWebhookError(400, "invalid_subscriptions", cause instanceof Error ? cause.message : "Webhook subscriptions are invalid", "subscriptions"); }
    const description = normalizeDescription(body.description);
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(canonicalWebhookJson({ operation: "webhook_endpoint.create", url, description, subscriptions }));
    const secret = generateWebhookSigningSecret();
    const ciphertext = encryptWebhookSigningSecret(secret, this.keys);

    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "webhook_endpoint", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const [created] = await tx.insert(webhookEndpoints).values({ ...input, url, description, subscriptions, signingSecretCiphertext: ciphertext, secretVersion: this.keys.currentVersion, status: "active", createdAt: now, updatedAt: now }).onConflictDoNothing().returning();
      if (!created) throw new MerchantWebhookError(409, "webhook_endpoint_conflict", "A webhook endpoint with this URL already exists", "url");
      const safeBody = { ...endpointProjection(created), secret: null };
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: created.id, responseStatus: 201, responseBody: safeBody, now });
      await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "webhook_endpoint.created", resourceType: "webhook_endpoint", resourceId: created.id, requestId: input.requestId, metadataJson: { urlHost: new URL(url).hostname, subscriptions, secretVersion: created.secretVersion } });
      return { status: 201, body: { ...safeBody, secret }, replayed: false } as const;
    });
  }

  async listEndpoints(tenant: TenantContext) {
    const rows = await this.db.select().from(webhookEndpoints).where(and(eq(webhookEndpoints.merchantId, tenant.merchantId), eq(webhookEndpoints.environmentId, tenant.environmentId))).orderBy(desc(webhookEndpoints.createdAt), desc(webhookEndpoints.id));
    return { data: rows.map(endpointProjection) };
  }

  async updateEndpoint(input: WebhookActorInput & Readonly<{ endpointId: string; body: unknown }>) {
    const now = input.now ?? new Date();
    requireUuid(input.endpointId, "webhook_endpoint_not_found");
    const body = strictObject(input.body, ["url", "description", "subscriptions", "status"], "webhook_endpoint_update");
    if (Object.keys(body).length === 0) throw new MerchantWebhookError(400, "empty_update", "At least one webhook endpoint field is required");
    const patch: Partial<typeof webhookEndpoints.$inferInsert> = { updatedAt: now };
    if (Object.hasOwn(body, "url")) {
      try { patch.url = validateWebhookEndpointUrl(body.url); }
      catch (cause) { throw new MerchantWebhookError(400, "invalid_webhook_url", cause instanceof Error ? cause.message : "Webhook URL is invalid", "url"); }
    }
    if (Object.hasOwn(body, "description")) patch.description = normalizeDescription(body.description);
    if (Object.hasOwn(body, "subscriptions")) {
      try { patch.subscriptions = validateWebhookSubscriptions(body.subscriptions); }
      catch (cause) { throw new MerchantWebhookError(400, "invalid_subscriptions", cause instanceof Error ? cause.message : "Webhook subscriptions are invalid", "subscriptions"); }
    }
    if (Object.hasOwn(body, "status")) {
      if (body.status !== "active" && body.status !== "disabled") throw new MerchantWebhookError(400, "invalid_webhook_status", "status must be active or disabled", "status");
      patch.status = body.status;
    }
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(canonicalWebhookJson({ operation: "webhook_endpoint.update", endpointId: input.endpointId, patch }));
    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "webhook_endpoint_update", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const [updated] = await tx.update(webhookEndpoints).set(patch).where(and(eq(webhookEndpoints.id, input.endpointId), eq(webhookEndpoints.merchantId, input.merchantId), eq(webhookEndpoints.environmentId, input.environmentId))).returning();
      if (!updated) throw new MerchantWebhookError(404, "webhook_endpoint_not_found", "Webhook endpoint not found");
      if (updated.status === "disabled") {
        await tx.update(webhookDeliveries).set({ status: "dead_letter", responseCode: "endpoint_disabled", leaseOwner: null, leaseUntil: null, updatedAt: now }).where(and(eq(webhookDeliveries.endpointId, updated.id), inArray(webhookDeliveries.status, ["pending", "retrying", "delivering"])));
      }
      const response = endpointProjection(updated);
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: updated.id, responseStatus: 200, responseBody: response, now });
      await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "webhook_endpoint.updated", resourceType: "webhook_endpoint", resourceId: updated.id, requestId: input.requestId, metadataJson: { changedFields: Object.keys(body), status: updated.status } });
      return { status: 200, body: response, replayed: false } as const;
    });
  }

  async rotateSecret(input: WebhookActorInput & Readonly<{ endpointId: string }>) {
    const now = input.now ?? new Date();
    requireUuid(input.endpointId, "webhook_endpoint_not_found");
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(canonicalWebhookJson({ operation: "webhook_endpoint.rotate_secret", endpointId: input.endpointId }));
    const secret = generateWebhookSigningSecret();
    const ciphertext = encryptWebhookSigningSecret(secret, this.keys);
    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "webhook_secret_rotation", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const [updated] = await tx.update(webhookEndpoints).set({ signingSecretCiphertext: ciphertext, secretVersion: sql`${webhookEndpoints.secretVersion} + 1`, updatedAt: now }).where(and(eq(webhookEndpoints.id, input.endpointId), eq(webhookEndpoints.merchantId, input.merchantId), eq(webhookEndpoints.environmentId, input.environmentId))).returning();
      if (!updated) throw new MerchantWebhookError(404, "webhook_endpoint_not_found", "Webhook endpoint not found");
      const safeBody = { id: updated.id, secret: null, secret_version: updated.secretVersion };
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: updated.id, responseStatus: 200, responseBody: safeBody, now });
      await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "webhook_endpoint.secret_rotated", resourceType: "webhook_endpoint", resourceId: updated.id, requestId: input.requestId, metadataJson: { secretVersion: updated.secretVersion } });
      return { status: 200, body: { ...safeBody, secret }, replayed: false } as const;
    });
  }

  async enqueueTest(input: WebhookActorInput & Readonly<{ endpointId: string }>) {
    const now = input.now ?? new Date();
    requireUuid(input.endpointId, "webhook_endpoint_not_found");
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(canonicalWebhookJson({ operation: "webhook_endpoint.test", endpointId: input.endpointId }));
    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "webhook_test", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const endpoint = await tx.query.webhookEndpoints.findFirst({ where: and(eq(webhookEndpoints.id, input.endpointId), eq(webhookEndpoints.merchantId, input.merchantId), eq(webhookEndpoints.environmentId, input.environmentId), eq(webhookEndpoints.status, "active")) });
      if (!endpoint) throw new MerchantWebhookError(404, "webhook_endpoint_not_found", "Webhook endpoint not found");
      const eventId = randomUUID();
      const payload = { id: eventId, type: "webhook_endpoint.test", version: 1, created: now.toISOString(), environment: "test", data: { object: { id: endpoint.id, object: "webhook_endpoint" } } };
      const [event] = await tx.insert(webhookEvents).values({ id: eventId, ...input, type: "webhook_endpoint.test", schemaVersion: 1, payload, payloadHash: webhookPayloadHash(canonicalWebhookJson(payload)), canonicalEventKey: `test:${idempotency.claim.id}`, occurredAt: now }).returning();
      const [delivery] = await tx.insert(webhookDeliveries).values({ ...input, eventId: event!.id, endpointId: endpoint.id, status: "pending", nextAttemptAt: now }).returning();
      if (!delivery) throw new MerchantWebhookError(500, "webhook_delivery_unavailable", "Webhook test delivery could not be queued");
      const response = { event_id: event!.id, delivery_id: delivery.id, status: delivery.status };
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: delivery.id, responseStatus: 202, responseBody: response, now });
      await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "webhook_endpoint.test_queued", resourceType: "webhook_delivery", resourceId: delivery.id, requestId: input.requestId, metadataJson: { endpointId: endpoint.id, eventId: event!.id } });
      return { status: 202, body: response, replayed: false } as const;
    });
  }

  async listDeliveries(tenant: TenantContext, endpointId: string, limit = 25) {
    requireUuid(endpointId, "webhook_endpoint_not_found");
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new MerchantWebhookError(400, "invalid_limit", "limit must be an integer from 1 to 100", "limit");
    const endpoint = await this.db.query.webhookEndpoints.findFirst({ where: and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.merchantId, tenant.merchantId), eq(webhookEndpoints.environmentId, tenant.environmentId)) });
    if (!endpoint) throw new MerchantWebhookError(404, "webhook_endpoint_not_found", "Webhook endpoint not found");
    const rows = await this.db.select({ delivery: webhookDeliveries, eventType: webhookEvents.type, eventCreatedAt: webhookEvents.createdAt }).from(webhookDeliveries).innerJoin(webhookEvents, eq(webhookDeliveries.eventId, webhookEvents.id)).where(and(eq(webhookDeliveries.endpointId, endpointId), eq(webhookDeliveries.merchantId, tenant.merchantId), eq(webhookDeliveries.environmentId, tenant.environmentId))).orderBy(desc(webhookDeliveries.createdAt), desc(webhookDeliveries.id)).limit(limit);
    return { data: rows.map(({ delivery, eventType, eventCreatedAt }) => ({ id: delivery.id, event_id: delivery.eventId, event_type: eventType, status: delivery.status, attempt_count: delivery.attemptCount, next_attempt_at: delivery.nextAttemptAt.toISOString(), last_attempt_at: delivery.lastAttemptAt?.toISOString() ?? null, response_status: delivery.responseStatus, response_code: delivery.responseCode, delivered_at: delivery.deliveredAt?.toISOString() ?? null, event_created_at: eventCreatedAt.toISOString() })) };
  }

  async retryDelivery(input: WebhookActorInput & Readonly<{ deliveryId: string }>) {
    const now = input.now ?? new Date();
    requireUuid(input.deliveryId, "webhook_delivery_not_found");
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(canonicalWebhookJson({ operation: "webhook_delivery.retry", deliveryId: input.deliveryId }));
    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "webhook_delivery_retry", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const [updated] = await tx.update(webhookDeliveries).set({ status: "retrying", nextAttemptAt: now, responseCode: "manual_retry", leaseOwner: null, leaseUntil: null, updatedAt: now }).where(and(eq(webhookDeliveries.id, input.deliveryId), eq(webhookDeliveries.merchantId, input.merchantId), eq(webhookDeliveries.environmentId, input.environmentId), inArray(webhookDeliveries.status, ["exhausted", "dead_letter"]))).returning();
      if (!updated) {
        const hidden = await tx.query.webhookDeliveries.findFirst({ where: and(eq(webhookDeliveries.id, input.deliveryId), eq(webhookDeliveries.merchantId, input.merchantId), eq(webhookDeliveries.environmentId, input.environmentId)) });
        if (!hidden) throw new MerchantWebhookError(404, "webhook_delivery_not_found", "Webhook delivery not found");
        throw new MerchantWebhookError(409, "webhook_delivery_not_retryable", "Webhook delivery is not exhausted or dead-lettered");
      }
      const response = { id: updated.id, status: updated.status, next_attempt_at: updated.nextAttemptAt.toISOString() };
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: updated.id, responseStatus: 202, responseBody: response, now });
      await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "webhook_delivery.retry_queued", resourceType: "webhook_delivery", resourceId: updated.id, requestId: input.requestId, metadataJson: { endpointId: updated.endpointId, eventId: updated.eventId } });
      return { status: 202, body: response, replayed: false } as const;
    });
  }
}
