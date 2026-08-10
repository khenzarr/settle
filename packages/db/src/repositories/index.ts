import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { auditEvents, idempotencyKeys, merchantEnvironments, merchants, paymentIntentRecipients, paymentIntents } from "../schema/index.ts";
import type { DatabaseExecutor } from "../transaction.ts";
import { validateRecipients, type RecipientInput, type TenantContext } from "../types.ts";

export class MerchantRepository {
  constructor(private readonly db: DatabaseExecutor) {}
  async findEnvironment(tenant: TenantContext) {
    return this.db.query.merchantEnvironments.findFirst({ where: and(eq(merchantEnvironments.id, tenant.environmentId), eq(merchantEnvironments.merchantId, tenant.merchantId)) });
  }
  async create(input: typeof merchants.$inferInsert) { return (await this.db.insert(merchants).values(input).returning())[0]!; }
}

export class PaymentIntentRepository {
  constructor(private readonly db: DatabaseExecutor) {}
  async findByExternalOrderId(tenant: TenantContext, externalOrderId: string) {
    return this.db.query.paymentIntents.findFirst({ where: and(eq(paymentIntents.merchantId, tenant.merchantId), eq(paymentIntents.environmentId, tenant.environmentId), eq(paymentIntents.externalOrderId, externalOrderId)), with: { recipients: true, chainOrder: true } });
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
}

export class IdempotencyRepository {
  constructor(private readonly db: DatabaseExecutor) {}
  async find(tenant: TenantContext, keyDigest: string) { return this.db.query.idempotencyKeys.findFirst({ where: and(eq(idempotencyKeys.merchantId, tenant.merchantId), eq(idempotencyKeys.environmentId, tenant.environmentId), eq(idempotencyKeys.keyDigest, keyDigest)) }); }
  async claim(tenant: TenantContext, input: Omit<typeof idempotencyKeys.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(idempotencyKeys).values({ ...input, ...tenant }).onConflictDoNothing().returning())[0]; }
}

export class AuditRepository {
  constructor(private readonly db: DatabaseExecutor) {}
  async appendForTenant(tenant: TenantContext, input: Omit<typeof auditEvents.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(auditEvents).values({ ...input, ...tenant }).returning())[0]!; }
  async appendSystem(input: Omit<typeof auditEvents.$inferInsert, "merchantId" | "environmentId">) { return (await this.db.insert(auditEvents).values({ ...input, merchantId: null, environmentId: null }).returning())[0]!; }
  async listForTenant(tenant: TenantContext, limit = 100) { return this.db.select().from(auditEvents).where(and(eq(auditEvents.merchantId, tenant.merchantId), eq(auditEvents.environmentId, tenant.environmentId))).orderBy(desc(auditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 100)); }
}