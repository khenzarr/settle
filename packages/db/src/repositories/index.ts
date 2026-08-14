import "server-only";

import { and, desc, eq, gt, gte, isNull, lt, lte, or } from "drizzle-orm";
import { auditEvents, idempotencyKeys, merchantApiKeys, merchantEnvironments, merchants, paymentIntentRecipients, paymentIntents } from "../schema/index.ts";
import type { ApiKeyScope } from "../api-keys.ts";
import type { DatabaseExecutor } from "../transaction.ts";
import { validateRecipients, type RecipientInput, type TenantContext } from "../types.ts";

export class MerchantRepository {
  private readonly db: DatabaseExecutor;
  constructor(db: DatabaseExecutor) { this.db = db; }
  async findEnvironment(tenant: TenantContext) {
    return this.db.query.merchantEnvironments.findFirst({ where: and(eq(merchantEnvironments.id, tenant.environmentId), eq(merchantEnvironments.merchantId, tenant.merchantId)) });
  }
  async create(input: typeof merchants.$inferInsert) { return (await this.db.insert(merchants).values(input).returning())[0]!; }
}

export class PaymentIntentRepository {
  private readonly db: DatabaseExecutor;
  constructor(db: DatabaseExecutor) { this.db = db; }
  async findByExternalOrderId(tenant: TenantContext, externalOrderId: string) {
    return this.db.query.paymentIntents.findFirst({ where: and(eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.environmentId, tenant.environmentId), eq(paymentIntents.externalOrderId, externalOrderId)), with: { recipients: true, chainOrder: true } });
  }
  async findById(tenant: TenantContext, id: string) {
    return this.db.query.paymentIntents.findFirst({ where: and(eq(paymentIntents.id, id), eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.environmentId, tenant.environmentId)), with: { recipients: true, chainOrder: true, operatorExecutions: true } });
  }
  async createWithRecipients(tenant: TenantContext, intent: Omit<typeof paymentIntents.$inferInsert, "merchantId" | "environmentId">, recipients: readonly RecipientInput[]) {
    validateRecipients(recipients);
    const created = (await this.db.insert(paymentIntents).values({ ...intent, ...tenant }).returning())[0]!;
    await this.db.insert(paymentIntentRecipients).values(recipients.map((recipient, position) => ({ paymentIntentId: created.id, recipientAddress: recipient.recipientAddress.toLowerCase(), shareBps: recipient.shareBps, position })));
    return created;
  }
  async listRecent(tenant: TenantContext, limit = 50) {
    return this.db.select().from(paymentIntents).where(and(eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.environmentId, tenant.environmentId))).orderBy(desc(paymentIntents.createdAt), desc(paymentIntents.id)).limit(Math.min(Math.max(limit, 1), 100));
  }
  async listPage(tenant: TenantContext, input: Readonly<{ limit: number; afterCreatedAt?: Date; afterId?: string; beforeCreatedAt?: Date; beforeId?: string; createdGte?: Date; createdLte?: Date; applicationState?: typeof paymentIntents.$inferSelect.applicationState; externalOrderId?: string }>) {
    const startingAfter = input.afterCreatedAt && input.afterId ? or(lt(paymentIntents.createdAt, input.afterCreatedAt), and(eq(paymentIntents.createdAt, input.afterCreatedAt), lt(paymentIntents.id, input.afterId))) : undefined;
    const endingBefore = input.beforeCreatedAt && input.beforeId ? or(gt(paymentIntents.createdAt, input.beforeCreatedAt), and(eq(paymentIntents.createdAt, input.beforeCreatedAt), gt(paymentIntents.id, input.beforeId))) : undefined;
    return this.db.query.paymentIntents.findMany({
      where: and(eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.environmentId, tenant.environmentId), startingAfter, endingBefore, input.createdGte ? gte(paymentIntents.createdAt, input.createdGte) : undefined, input.createdLte ? lte(paymentIntents.createdAt, input.createdLte) : undefined, input.applicationState ? eq(paymentIntents.applicationState, input.applicationState) : undefined, input.externalOrderId ? eq(paymentIntents.externalOrderId, input.externalOrderId) : undefined),
      with: { recipients: true, chainOrder: true, operatorExecutions: true },
      orderBy: [desc(paymentIntents.createdAt), desc(paymentIntents.id)],
      limit: Math.min(Math.max(input.limit, 1), 101),
    });
  }
}

export class IdempotencyRepository {
  private readonly db: DatabaseExecutor;
  constructor(db: DatabaseExecutor) { this.db = db; }
  async find(tenant: TenantContext, keyDigest: string) { return this.db.query.idempotencyKeys.findFirst({ where: and(eq(idempotencyKeys.merchantId, tenant.merchantId), eq(idempotencyKeys.environmentId, tenant.environmentId), eq(idempotencyKeys.keyDigest, keyDigest)) }); }
  async claim(tenant: TenantContext, input: Omit<typeof idempotencyKeys.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(idempotencyKeys).values({ ...input, ...tenant }).onConflictDoNothing().returning())[0]; }
  async findForUpdate(tenant: TenantContext, keyDigest: string) { return (await this.db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.merchantId, tenant.merchantId), eq(idempotencyKeys.environmentId, tenant.environmentId), eq(idempotencyKeys.keyDigest, keyDigest))).for("update").limit(1))[0]; }
  async complete(id: string, input: Readonly<{ resourceId: string; responseStatus: number; responseBody: Record<string, unknown>; now?: Date }>) {
    const now = input.now ?? new Date();
    return (await this.db.update(idempotencyKeys).set({ resourceId: input.resourceId, responseStatus: input.responseStatus, responseBody: input.responseBody, status: "completed", updatedAt: now }).where(eq(idempotencyKeys.id, id)).returning())[0]!;
  }
}

export class AuditRepository {
  private readonly db: DatabaseExecutor;
  constructor(db: DatabaseExecutor) { this.db = db; }
  async appendForTenant(tenant: TenantContext, input: Omit<typeof auditEvents.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(auditEvents).values({ ...input, ...tenant }).returning())[0]!; }
  async appendSystem(input: Omit<typeof auditEvents.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(auditEvents).values({ ...input, merchantId: null, environmentId: null }).returning())[0]!; }
  async listForTenant(tenant: TenantContext, limit = 100) { return this.db.select().from(auditEvents).where(and(eq(auditEvents.merchantId, tenant.merchantId), eq(auditEvents.environmentId, tenant.environmentId))).orderBy(desc(auditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100)); }
}

export class MerchantApiKeyRepository {
  private readonly db: DatabaseExecutor;
  constructor(db: DatabaseExecutor) { this.db = db; }

  async findAuthenticationContext(keyId: string) {
    return (await this.db.select({
      id: merchantApiKeys.id,
      merchantId: merchantApiKeys.merchantId,
      environmentId: merchantApiKeys.environmentId,
      secretDigest: merchantApiKeys.secretDigest,
      digestVersion: merchantApiKeys.digestVersion,
      scopesJson: merchantApiKeys.scopesJson,
      expiresAt: merchantApiKeys.expiresAt,
      revokedAt: merchantApiKeys.revokedAt,
      merchantStatus: merchants.status,
      environmentKind: merchantEnvironments.kind,
      environmentStatus: merchantEnvironments.status,
    }).from(merchantApiKeys)
      .innerJoin(merchants, eq(merchantApiKeys.merchantId, merchants.id))
      .innerJoin(merchantEnvironments, and(eq(merchantApiKeys.environmentId, merchantEnvironments.id), eq(merchantApiKeys.merchantId, merchantEnvironments.merchantId)))
      .where(eq(merchantApiKeys.keyId, keyId)).limit(1))[0];
  }

  async findTestEnvironment(tenant: TenantContext) {
    return (await this.db.select({ merchantStatus: merchants.status, environmentStatus: merchantEnvironments.status, environmentKind: merchantEnvironments.kind })
      .from(merchantEnvironments)
      .innerJoin(merchants, eq(merchantEnvironments.merchantId, merchants.id))
      .where(and(eq(merchantEnvironments.id, tenant.environmentId), eq(merchantEnvironments.merchantId, tenant.merchantId)))
      .limit(1))[0];
  }

  async create(tenant: TenantContext, input: Readonly<{
    name: string;
    keyId: string;
    prefix: string;
    secretDigest: string;
    digestVersion: number;
    scopes: readonly ApiKeyScope[];
    expiresAt?: Date;
    createdByMemberId?: string;
  }>) {
    return (await this.db.insert(merchantApiKeys).values({
      ...tenant,
      name: input.name,
      keyId: input.keyId,
      prefix: input.prefix,
      secretDigest: input.secretDigest,
      digestVersion: input.digestVersion,
      scopesJson: input.scopes,
      expiresAt: input.expiresAt,
      createdByMemberId: input.createdByMemberId,
    }).returning({ id: merchantApiKeys.id, name: merchantApiKeys.name, keyId: merchantApiKeys.keyId, prefix: merchantApiKeys.prefix, scopes: merchantApiKeys.scopesJson, expiresAt: merchantApiKeys.expiresAt, createdAt: merchantApiKeys.createdAt }))[0]!;
  }

  async list(tenant: TenantContext) {
    return this.db.select({ id: merchantApiKeys.id, name: merchantApiKeys.name, keyId: merchantApiKeys.keyId, prefix: merchantApiKeys.prefix, scopes: merchantApiKeys.scopesJson, lastUsedAt: merchantApiKeys.lastUsedAt, expiresAt: merchantApiKeys.expiresAt, revokedAt: merchantApiKeys.revokedAt, createdAt: merchantApiKeys.createdAt })
      .from(merchantApiKeys)
      .where(and(eq(merchantApiKeys.merchantId, tenant.merchantId), eq(merchantApiKeys.environmentId, tenant.environmentId)))
      .orderBy(desc(merchantApiKeys.createdAt), desc(merchantApiKeys.id));
  }

  async revoke(tenant: TenantContext, id: string, revokedAt = new Date()) {
    return (await this.db.update(merchantApiKeys).set({ revokedAt, updatedAt: revokedAt })
      .where(and(eq(merchantApiKeys.id, id), eq(merchantApiKeys.merchantId, tenant.merchantId), eq(merchantApiKeys.environmentId, tenant.environmentId), isNull(merchantApiKeys.revokedAt)))
      .returning({ id: merchantApiKeys.id, revokedAt: merchantApiKeys.revokedAt }))[0];
  }

  async markUsed(id: string, usedAt = new Date()) {
    return (await this.db.update(merchantApiKeys).set({ lastUsedAt: usedAt, updatedAt: usedAt })
      .where(and(eq(merchantApiKeys.id, id), isNull(merchantApiKeys.revokedAt), or(isNull(merchantApiKeys.expiresAt), gt(merchantApiKeys.expiresAt, usedAt))))
      .returning({ id: merchantApiKeys.id }))[0];
  }
}
