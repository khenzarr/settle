import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";

import type { SettleDatabase } from "./client.ts";
import { AuditRepository } from "./repositories/index.ts";
import { webhookDeliveries, webhookDeliveryAttempts, webhookEndpoints } from "./schema/index.ts";
import {
  canonicalWebhookJson,
  classifyWebhookResponse,
  createWebhookSignatureHeader,
  decryptWebhookSigningSecret,
  isForbiddenWebhookAddress,
  validateWebhookEndpointUrl,
  webhookPayloadHash,
  webhookRetryDelaySeconds,
  type WebhookEncryptionKeySet,
} from "./webhook-security.ts";

const DELIVERY_TIMEOUT_MS = 5_000;
const LEASE_MS = 60_000;
const MAX_AUTOMATIC_ATTEMPTS = 8;
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface WebhookHttpResult {
  readonly status: number;
}

export interface WebhookHttpTransport {
  post(url: string, body: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<WebhookHttpResult>;
}

export class WebhookTransportError extends Error {
  readonly code: "destination_rejected" | "dns_error" | "network_error" | "timeout" | "response_too_large";
  constructor(code: WebhookTransportError["code"], message: string) {
    super(message);
    this.name = "WebhookTransportError";
    this.code = code;
  }
}

async function resolvePinnedAddress(hostname: string): Promise<Readonly<{ address: string; family: 4 | 6 }>> {
  if (isIP(hostname)) {
    if (isForbiddenWebhookAddress(hostname)) throw new WebhookTransportError("destination_rejected", "Webhook destination is not public");
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }
  let resolved: readonly Readonly<{ address: string; family: number }>[];
  try { resolved = await lookup(hostname, { all: true, verbatim: true }); }
  catch { throw new WebhookTransportError("dns_error", "Webhook destination could not be resolved"); }
  if (!resolved.length || resolved.some((entry) => isForbiddenWebhookAddress(entry.address))) {
    throw new WebhookTransportError("destination_rejected", "Webhook destination resolved to a non-public address");
  }
  const selected = resolved[0]!;
  return { address: selected.address, family: selected.family as 4 | 6 };
}

export class PinnedHttpsWebhookTransport implements WebhookHttpTransport {
  async post(value: string, body: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<WebhookHttpResult> {
    let normalized: string;
    try { normalized = validateWebhookEndpointUrl(value); }
    catch (cause) { throw new WebhookTransportError("destination_rejected", cause instanceof Error ? cause.message : "Webhook destination is invalid"); }
    const url = new URL(normalized);
    const targetHostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const pinned = await resolvePinnedAddress(targetHostname);
    const pinnedLookup: LookupFunction = ((_: string, options: unknown, callback: (...args: unknown[]) => void) => {
      if (typeof options === "object" && options !== null && "all" in options && (options as { all?: boolean }).all) callback(null, [{ address: pinned.address, family: pinned.family }]);
      else callback(null, pinned.address, pinned.family);
    }) as LookupFunction;

    return new Promise<WebhookHttpResult>((resolve, reject) => {
      const request = httpsRequest({
        protocol: "https:",
        hostname: targetHostname,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { ...headers, "content-length": String(Buffer.byteLength(body, "utf8")) },
        lookup: pinnedLookup,
        servername: isIP(targetHostname) ? undefined : targetHostname,
        agent: false,
      }, (response) => {
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) response.destroy(new WebhookTransportError("response_too_large", "Webhook response exceeded the configured limit"));
        });
        response.on("end", () => resolve({ status: response.statusCode ?? 502 }));
        response.on("error", (error) => reject(error));
      });
      request.setTimeout(timeoutMs, () => request.destroy(new WebhookTransportError("timeout", "Webhook delivery timed out")));
      request.on("error", (cause) => reject(cause instanceof WebhookTransportError ? cause : new WebhookTransportError("network_error", "Webhook delivery failed")));
      request.end(body, "utf8");
    });
  }
}

type ClaimedDelivery = NonNullable<Awaited<ReturnType<WebhookDeliveryWorker["claimNext"]>>>;

export class WebhookDeliveryWorker {
  private readonly db: SettleDatabase;
  private readonly keys: WebhookEncryptionKeySet;
  private readonly transport: WebhookHttpTransport;
  constructor(db: SettleDatabase, keys: WebhookEncryptionKeySet, transport: WebhookHttpTransport = new PinnedHttpsWebhookTransport()) {
    this.db = db;
    this.keys = keys;
    this.transport = transport;
  }

  async claimNext(workerId: string, now = new Date()) {
    if (!workerId.trim() || workerId.length > 120) throw new RangeError("Webhook worker ID must contain 1 to 120 characters");
    return this.db.transaction(async (tx) => {
      const [candidate] = await tx.select().from(webhookDeliveries).where(and(
        inArray(webhookDeliveries.status, ["pending", "retrying", "delivering"]),
        lte(webhookDeliveries.nextAttemptAt, now),
        or(isNull(webhookDeliveries.leaseUntil), lte(webhookDeliveries.leaseUntil, now)),
      )).orderBy(webhookDeliveries.nextAttemptAt, webhookDeliveries.createdAt).for("update", { skipLocked: true }).limit(1);
      if (!candidate) return undefined;
      const attemptCount = candidate.status === "delivering" ? Math.max(1, candidate.attemptCount) : candidate.attemptCount + 1;
      const [claimed] = await tx.update(webhookDeliveries).set({ status: "delivering", attemptCount, lastAttemptAt: now, leaseOwner: workerId, leaseUntil: new Date(now.getTime() + LEASE_MS), updatedAt: now }).where(eq(webhookDeliveries.id, candidate.id)).returning();
      return claimed;
    });
  }

  private async loadClaim(claim: ClaimedDelivery) {
    return this.db.query.webhookDeliveries.findFirst({ where: and(eq(webhookDeliveries.id, claim.id), eq(webhookDeliveries.leaseOwner, claim.leaseOwner!)), with: { event: true, endpoint: true } });
  }

  private async completeAttempt(claim: ClaimedDelivery, input: Readonly<{ startedAt: Date; finishedAt: Date; responseStatus?: number; failureCode?: string }>) {
    const classification = classifyWebhookResponse(input.responseStatus, input.failureCode);
    const terminalStatus = classification === "delivered" ? "delivered" : classification === "terminal_failure" ? "dead_letter" : claim.attemptCount >= MAX_AUTOMATIC_ATTEMPTS ? "exhausted" : "retrying";
    const responseCode = input.failureCode ?? (input.responseStatus === undefined ? "unknown_failure" : `http_${input.responseStatus}`);
    const nextAttemptAt = terminalStatus === "retrying" ? new Date(input.finishedAt.getTime() + webhookRetryDelaySeconds(claim.attemptCount, claim.id) * 1000) : input.finishedAt;
    const durationMs = Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime());

    return this.db.transaction(async (tx) => {
      await tx.insert(webhookDeliveryAttempts).values({ deliveryId: claim.id, attemptNumber: claim.attemptCount, startedAt: input.startedAt, finishedAt: input.finishedAt, outcome: classification, responseStatus: input.responseStatus, failureCode: classification === "delivered" ? null : responseCode, durationMs, signatureVersion: claim.requestSignatureVersion ?? 1 });
      const [updated] = await tx.update(webhookDeliveries).set({
        status: terminalStatus,
        nextAttemptAt,
        responseStatus: input.responseStatus,
        responseCode,
        deliveredAt: terminalStatus === "delivered" ? input.finishedAt : null,
        leaseOwner: null,
        leaseUntil: null,
        updatedAt: input.finishedAt,
      }).where(and(eq(webhookDeliveries.id, claim.id), eq(webhookDeliveries.status, "delivering"), eq(webhookDeliveries.leaseOwner, claim.leaseOwner!))).returning();
      if (!updated) throw new Error("Webhook delivery lease was lost before completion");
      if (terminalStatus === "delivered") await tx.update(webhookEndpoints).set({ lastSuccessAt: input.finishedAt, updatedAt: input.finishedAt }).where(eq(webhookEndpoints.id, claim.endpointId));
      if (terminalStatus === "exhausted" || terminalStatus === "dead_letter") {
        await new AuditRepository(tx).appendForTenant(updated, { actorType: "worker", actorSubject: claim.leaseOwner!, action: `webhook_delivery.${terminalStatus}`, resourceType: "webhook_delivery", resourceId: updated.id, metadataJson: { endpointId: updated.endpointId, eventId: updated.eventId, attemptCount: updated.attemptCount, responseCode } });
      }
      return updated;
    });
  }

  async deliverNext(workerId: string, now = new Date()) {
    const claim = await this.claimNext(workerId, now);
    if (!claim) return undefined;
    const loaded = await this.loadClaim(claim);
    if (!loaded) throw new Error("Claimed webhook delivery could not be loaded");
    const startedAt = now;
    const wallStartedAt = Date.now();
    const finishedAt = () => new Date(startedAt.getTime() + Math.max(0, Date.now() - wallStartedAt));
    if (loaded.endpoint.status !== "active") return this.completeAttempt(claim, { startedAt, finishedAt: finishedAt(), failureCode: "endpoint_disabled" });
    const rawBody = canonicalWebhookJson(loaded.event.payload);
    if (webhookPayloadHash(rawBody) !== loaded.event.payloadHash) return this.completeAttempt(claim, { startedAt, finishedAt: finishedAt(), failureCode: "payload_hash_mismatch" });
    let secret: string;
    try { secret = decryptWebhookSigningSecret(loaded.endpoint.signingSecretCiphertext, this.keys); }
    catch { return this.completeAttempt(claim, { startedAt, finishedAt: finishedAt(), failureCode: "secret_unavailable" }); }
    const timestamp = Math.floor(startedAt.getTime() / 1000);
    await this.db.update(webhookDeliveries).set({ requestSignatureVersion: loaded.endpoint.secretVersion }).where(and(eq(webhookDeliveries.id, claim.id), eq(webhookDeliveries.leaseOwner, workerId)));
    claim.requestSignatureVersion = loaded.endpoint.secretVersion;
    try {
      const response = await this.transport.post(loaded.endpoint.url, rawBody, {
        "content-type": "application/json; charset=utf-8",
        "user-agent": "Settle-Webhooks/1.0",
        "settle-event-id": loaded.event.id,
        "settle-signature": createWebhookSignatureHeader(secret, timestamp, rawBody),
      }, DELIVERY_TIMEOUT_MS);
      return this.completeAttempt(claim, { startedAt, finishedAt: finishedAt(), responseStatus: response.status });
    } catch (cause) {
      const failureCode = cause instanceof WebhookTransportError ? cause.code : "network_error";
      return this.completeAttempt(claim, { startedAt, finishedAt: finishedAt(), failureCode });
    }
  }

  async processBatch(workerId: string, limit = 10) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Webhook batch limit must be an integer from 1 to 50");
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await this.deliverNext(workerId);
      if (!result) break;
      results.push(result);
    }
    return results;
  }
}
