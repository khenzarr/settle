import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";

import { apiRateLimitBuckets } from "./schema/index.ts";
import type { DatabaseExecutor } from "./transaction.ts";
import type { TenantContext } from "./types.ts";

export type RateLimitRouteGroup = "payment_intents.read" | "payment_intents.write" | "payment_intents.activate" | "webhook_endpoints.read" | "webhook_endpoints.write" | "webhook_deliveries.retry";
const LIMITS: Record<RateLimitRouteGroup, Readonly<{ apiKey: number; merchant: number; ip: number }>> = {
  "payment_intents.read": { apiKey: 120, merchant: 600, ip: 240 },
  "payment_intents.write": { apiKey: 60, merchant: 300, ip: 120 },
  "payment_intents.activate": { apiKey: 10, merchant: 50, ip: 20 },
  "webhook_endpoints.read": { apiKey: 60, merchant: 300, ip: 120 },
  "webhook_endpoints.write": { apiKey: 20, merchant: 100, ip: 40 },
  "webhook_deliveries.retry": { apiKey: 10, merchant: 30, ip: 20 },
};

export class PersistentRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded");
    this.name = "PersistentRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class PersistentRateLimitService {
  private readonly db: DatabaseExecutor;
  private readonly digestKey: string;
  constructor(db: DatabaseExecutor, digestKey: string) {
    if (Buffer.byteLength(digestKey, "utf8") < 32) throw new RangeError("Rate-limit digest key must contain at least 32 bytes");
    this.db = db;
    this.digestKey = digestKey;
  }

  private digest(value: string) { return createHmac("sha256", this.digestKey).update(value, "utf8").digest("hex"); }

  private async consume(tenant: TenantContext, input: Readonly<{ dimension: "api_key" | "merchant" | "ip"; subject: string; routeGroup: RateLimitRouteGroup; limit: number; now: Date }>) {
    const windowSeconds = 60;
    const windowStartMs = Math.floor(input.now.getTime() / 60_000) * 60_000;
    const rows = await this.db.insert(apiRateLimitBuckets).values({ ...tenant, dimension: input.dimension, subjectDigest: this.digest(input.subject), routeGroup: input.routeGroup, windowStart: new Date(windowStartMs), windowSeconds }).onConflictDoUpdate({
      target: [apiRateLimitBuckets.merchantId, apiRateLimitBuckets.environmentId, apiRateLimitBuckets.dimension, apiRateLimitBuckets.subjectDigest, apiRateLimitBuckets.routeGroup, apiRateLimitBuckets.windowStart],
      set: { requestCount: sql`${apiRateLimitBuckets.requestCount} + 1`, updatedAt: input.now },
      setWhere: sql`${apiRateLimitBuckets.requestCount} < ${input.limit}`,
    }).returning({ count: apiRateLimitBuckets.requestCount });
    if (rows.length === 0) throw new PersistentRateLimitError(Math.max(1, Math.ceil((windowStartMs + 60_000 - input.now.getTime()) / 1000)));
    return { limit: input.limit, remaining: Math.max(0, input.limit - rows[0]!.count), resetAt: new Date(windowStartMs + 60_000) };
  }

  async consumeRequest(input: TenantContext & Readonly<{ apiKeyId: string; routeGroup: RateLimitRouteGroup; ip?: string; now?: Date }>) {
    const now = input.now ?? new Date();
    const limits = LIMITS[input.routeGroup];
    const consumed = [
      await this.consume(input, { dimension: "api_key", subject: input.apiKeyId, routeGroup: input.routeGroup, limit: limits.apiKey, now }),
      await this.consume(input, { dimension: "merchant", subject: input.merchantId, routeGroup: input.routeGroup, limit: limits.merchant, now }),
    ];
    if (input.ip) consumed.push(await this.consume(input, { dimension: "ip", subject: input.ip, routeGroup: input.routeGroup, limit: limits.ip, now }));
    return consumed.reduce((mostConstrained, current) => current.remaining / current.limit < mostConstrained.remaining / mostConstrained.limit ? current : mostConstrained);
  }
}
