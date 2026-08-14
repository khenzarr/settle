import "server-only";

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { canonicalMerchantPaymentIntentRequest, formatUsdcAmount, normalizeMerchantPaymentIntentCreate } from "@settle/shared";

import type { SettleDatabase } from "./client.ts";
import { AuditRepository, IdempotencyRepository, PaymentIntentRepository } from "./repositories/index.ts";
import { operatorExecutions, paymentIntents } from "./schema/index.ts";
import type { SettleTransaction } from "./transaction.ts";
import type { TenantContext } from "./types.ts";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPLICATION_STATES = new Set(["planned", "awaiting_activation", "awaiting_payment", "payment_window_expired", "funded", "disputed", "completed", "refunded", "cancelled"] as const);

export class MerchantPaymentIntentError extends Error {
  readonly status: 400 | 404 | 409 | 422 | 500;
  readonly code: string;
  readonly param?: string;
  constructor(
    status: 400 | 404 | 409 | 422 | 500,
    code: string,
    message: string,
    param?: string,
  ) {
    super(message);
    this.name = "MerchantPaymentIntentError";
    this.status = status;
    this.code = code;
    this.param = param;
  }
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

export function validateIdempotencyKey(value: string | null): string {
  if (!value || value.length > 255 || !/^[\x21-\x7e]+$/.test(value)) throw new MerchantPaymentIntentError(400, "invalid_idempotency_key", "Idempotency-Key must contain 1 to 255 printable characters", "Idempotency-Key");
  return value;
}

function canonicalStatus(value: string) {
  return value === "none" ? null : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

type IntentRecord = NonNullable<Awaited<ReturnType<PaymentIntentRepository["findById"]>>>;

export function projectMerchantPaymentIntent(record: IntentRecord, checkoutOrigin?: string) {
  const activation = record.operatorExecutions.find((operation) => operation.operation === "activation");
  const canonicalVerified = record.chainOrder?.verificationState === "verified" && record.chainOrder.canonicalStatus !== "none";
  const checkoutUrl = canonicalVerified && record.checkoutPath && checkoutOrigin ? new URL(record.checkoutPath, checkoutOrigin).toString() : null;
  return {
    id: record.id,
    external_order_id: record.externalOrderId,
    buyer: record.buyerAddress,
    amount: formatUsdcAmount(record.amountBaseUnits),
    currency: record.currency,
    funding_deadline: record.fundingDeadline.toISOString(),
    settlement_deadline: record.settlementDeadline.toISOString(),
    settlement_recipients: [...record.recipients].sort((left, right) => left.position - right.position).map((recipient) => ({ address: recipient.recipientAddress, share_bps: recipient.shareBps })),
    metadata: record.metadata,
    order_id: record.orderId,
    terms_hash: record.termsHash,
    checkout_url: checkoutUrl,
    application_state: record.applicationState,
    canonical: record.chainOrder && record.chainOrder.canonicalStatus !== "none" ? {
      status: canonicalStatus(record.chainOrder.canonicalStatus),
      observed_at: record.chainOrder.lastVerifiedAt?.toISOString() ?? null,
      block_number: record.chainOrder.lastVerifiedBlock?.toString() ?? null,
      verification_state: record.chainOrder.verificationState,
    } : null,
    operations: { activation: activation?.state ?? "not_started", settlement: "not_started" },
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

type IdempotencyClaim = Awaited<ReturnType<IdempotencyRepository["claim"]>>;

async function claimOrReplay(tx: SettleTransaction, tenant: TenantContext, input: Readonly<{ key: string; fingerprint: string; resourceType: string; now: Date }>): Promise<{ kind: "new"; claim: NonNullable<IdempotencyClaim> } | { kind: "replay"; status: number; body: Record<string, unknown> }> {
  const repository = new IdempotencyRepository(tx);
  const keyDigest = sha256(input.key);
  const claim = await repository.claim(tenant, { keyDigest, requestFingerprint: input.fingerprint, resourceType: input.resourceType, expiresAt: new Date(input.now.getTime() + IDEMPOTENCY_TTL_MS) });
  if (claim) return { kind: "new", claim };
  const existing = await repository.findForUpdate(tenant, keyDigest);
  if (!existing) throw new MerchantPaymentIntentError(500, "idempotency_state_unavailable", "Idempotency state is temporarily unavailable");
  if (existing.requestFingerprint !== input.fingerprint) throw new MerchantPaymentIntentError(409, "idempotency_key_reused", "Idempotency-Key was already used with a different request");
  if (existing.status === "completed" && existing.responseStatus && existing.responseBody) return { kind: "replay", status: existing.responseStatus, body: existing.responseBody };
  throw new MerchantPaymentIntentError(409, "request_in_progress", "An identical request is already being processed");
}

function encodeCursor(record: IntentRecord) {
  return Buffer.from(JSON.stringify([record.createdAt.toISOString(), record.id]), "utf8").toString("base64url");
}

function decodeCursor(value: string | undefined, param: "starting_after" | "ending_before") {
  if (!value) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== "string" || typeof decoded[1] !== "string" || !UUID_PATTERN.test(decoded[1])) throw new Error("invalid");
    const createdAt = new Date(decoded[0]);
    if (Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return { createdAt, id: decoded[1] };
  } catch {
    throw new MerchantPaymentIntentError(400, "invalid_cursor", `${param} is invalid`, param);
  }
}

function parseCreatedFilter(value: string | undefined, param: "created[gte]" | "created[lte]") {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new MerchantPaymentIntentError(400, "invalid_created_filter", `${param} must be an ISO-8601 timestamp`, param);
  return date;
}

export class MerchantPaymentIntentService {
  private readonly db: SettleDatabase;
  constructor(db: SettleDatabase) { this.db = db; }

  async create(input: TenantContext & Readonly<{ apiKeyId: string; idempotencyKey: string; body: unknown; requestId: string; checkoutOrigin?: string; now?: Date }>) {
    const now = input.now ?? new Date();
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    let normalized;
    try { normalized = normalizeMerchantPaymentIntentCreate(input.body, now); }
    catch (cause) { throw new MerchantPaymentIntentError(400, "invalid_payment_intent", cause instanceof Error ? cause.message : "Payment Intent request is invalid"); }
    const fingerprint = sha256(canonicalMerchantPaymentIntentRequest(normalized));

    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "payment_intent", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const repository = new PaymentIntentRepository(tx);
      const existing = await repository.findByExternalOrderId(input, normalized.externalOrderId);
      if (existing && (existing.orderId !== normalized.plan.order.orderId || existing.termsHash !== normalized.plan.order.termsHash)) throw new MerchantPaymentIntentError(409, "external_order_id_conflict", "external_order_id already exists with different immutable terms", "external_order_id");

      let intentId = existing?.id;
      if (!intentId) {
        const created = await repository.createWithRecipients(input, {
          externalOrderId: normalized.externalOrderId,
          buyerAddress: normalized.buyer,
          currency: "USDC",
          amountBaseUnits: BigInt(normalized.plan.order.amount.baseUnits),
          fundingDeadline: normalized.fundingDeadline,
          settlementDeadline: normalized.settlementDeadline,
          orderId: normalized.plan.order.orderId,
          termsHash: normalized.plan.order.termsHash,
          metadata: normalized.metadata,
        }, normalized.recipients.map((recipient) => ({ recipientAddress: recipient.address, shareBps: recipient.shareBps })));
        intentId = created.id;
        await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "payment_intent.created", resourceType: "payment_intent", resourceId: intentId, requestId: input.requestId, metadataJson: { externalOrderId: normalized.externalOrderId, orderId: normalized.plan.order.orderId } });
      }
      const record = await repository.findById(input, intentId);
      if (!record) throw new MerchantPaymentIntentError(500, "payment_intent_unavailable", "Payment Intent could not be loaded after creation");
      const body = projectMerchantPaymentIntent(record, input.checkoutOrigin);
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: record.id, responseStatus: 201, responseBody: body, now });
      return { status: 201, body, replayed: Boolean(existing) } as const;
    });
  }

  async get(tenant: TenantContext, id: string, checkoutOrigin?: string) {
    if (!UUID_PATTERN.test(id)) throw new MerchantPaymentIntentError(404, "payment_intent_not_found", "Payment Intent not found");
    const record = await new PaymentIntentRepository(this.db).findById(tenant, id);
    if (!record) throw new MerchantPaymentIntentError(404, "payment_intent_not_found", "Payment Intent not found");
    return projectMerchantPaymentIntent(record, checkoutOrigin);
  }

  async list(tenant: TenantContext, input: Readonly<{ limit?: number; startingAfter?: string; endingBefore?: string; status?: string; externalOrderId?: string; createdGte?: string; createdLte?: string; checkoutOrigin?: string }>) {
    const limit = input.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new MerchantPaymentIntentError(400, "invalid_limit", "limit must be an integer from 1 to 100", "limit");
    if (input.status && !APPLICATION_STATES.has(input.status as never)) throw new MerchantPaymentIntentError(400, "invalid_status", "status is invalid", "status");
    if (input.startingAfter && input.endingBefore) throw new MerchantPaymentIntentError(400, "conflicting_cursors", "starting_after and ending_before cannot be used together");
    const after = decodeCursor(input.startingAfter, "starting_after");
    const before = decodeCursor(input.endingBefore, "ending_before");
    const createdGte = parseCreatedFilter(input.createdGte, "created[gte]");
    const createdLte = parseCreatedFilter(input.createdLte, "created[lte]");
    if (createdGte && createdLte && createdGte > createdLte) throw new MerchantPaymentIntentError(400, "invalid_created_range", "created[gte] must not be later than created[lte]");
    const rows = await new PaymentIntentRepository(this.db).listPage(tenant, { limit: limit + 1, ...(after ? { afterCreatedAt: after.createdAt, afterId: after.id } : {}), ...(before ? { beforeCreatedAt: before.createdAt, beforeId: before.id } : {}), createdGte, createdLte, applicationState: input.status as typeof paymentIntents.$inferSelect.applicationState | undefined, externalOrderId: input.externalOrderId });
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    return { data: selected.map((record) => projectMerchantPaymentIntent(record, input.checkoutOrigin)), has_more: hasMore, next_cursor: hasMore && selected.length ? encodeCursor(selected[selected.length - 1]!) : null };
  }

  async activate(input: TenantContext & Readonly<{ apiKeyId: string; paymentIntentId: string; idempotencyKey: string; requestId: string; checkoutOrigin?: string; now?: Date }>) {
    const now = input.now ?? new Date();
    if (!UUID_PATTERN.test(input.paymentIntentId)) throw new MerchantPaymentIntentError(404, "payment_intent_not_found", "Payment Intent not found");
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const fingerprint = sha256(JSON.stringify({ operation: "activation", payment_intent_id: input.paymentIntentId }));
    return this.db.transaction(async (tx) => {
      const idempotency = await claimOrReplay(tx, input, { key: idempotencyKey, fingerprint, resourceType: "payment_intent_activation", now });
      if (idempotency.kind === "replay") return { status: idempotency.status, body: idempotency.body, replayed: true } as const;
      const repository = new PaymentIntentRepository(tx);
      const record = await repository.findById(input, input.paymentIntentId);
      if (!record) throw new MerchantPaymentIntentError(404, "payment_intent_not_found", "Payment Intent not found");
      if (record.fundingDeadline <= now) throw new MerchantPaymentIntentError(409, "payment_window_expired", "Payment Intent funding deadline has passed");
      if (!["planned", "awaiting_activation"].includes(record.applicationState)) throw new MerchantPaymentIntentError(409, "invalid_payment_intent_state", "Payment Intent cannot be activated from its current state");

      const [operation] = await tx.insert(operatorExecutions).values({ ...input, paymentIntentId: record.id, operation: "activation", state: "queued", providerIdempotencyDigest: sha256(`settle.operator.activation.v1:${record.id}:${record.orderId}`), requestedBySubject: input.apiKeyId }).onConflictDoNothing().returning();
      await tx.update(paymentIntents).set({ applicationState: "awaiting_activation", updatedAt: now }).where(and(eq(paymentIntents.id, record.id), eq(paymentIntents.merchantId, input.merchantId), eq(paymentIntents.environmentId, input.environmentId), eq(paymentIntents.applicationState, "planned")));
      if (operation) await new AuditRepository(tx).appendForTenant(input, { actorType: "merchant_api_key", actorSubject: input.apiKeyId, action: "payment_intent.activation_queued", resourceType: "payment_intent", resourceId: record.id, requestId: input.requestId, metadataJson: { operationId: operation.id } });
      const updated = await repository.findById(input, record.id);
      if (!updated) throw new MerchantPaymentIntentError(500, "payment_intent_unavailable", "Payment Intent could not be loaded after activation request");
      const body = projectMerchantPaymentIntent(updated, input.checkoutOrigin);
      await new IdempotencyRepository(tx).complete(idempotency.claim.id, { resourceId: record.id, responseStatus: 202, responseBody: body, now });
      return { status: 202, body, replayed: !operation } as const;
    });
  }
}
