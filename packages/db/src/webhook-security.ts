import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const WEBHOOK_EVENT_TYPES = [
  "webhook_endpoint.test",
  "payment_intent.created",
  "payment_intent.activated",
  "payment_intent.payment_window_expired",
  "payment_intent.funded",
  "payment_intent.disputed",
  "payment_intent.completed",
  "payment_intent.refunded",
  "payment_intent.cancelled",
  "payment_intent.reconciliation_issue",
  "payment_intent.webhook_delivery_failed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];
export const WEBHOOK_SECRET_VERSION = 1 as const;
export const WEBHOOK_SIGNATURE_VERSION = 1 as const;
const ENCRYPTION_AAD = Buffer.from("settle.webhook.secret.v1", "utf8");
const MAX_ENDPOINT_URL_BYTES = 2048;

export interface WebhookEncryptionKeySet {
  readonly currentVersion: typeof WEBHOOK_SECRET_VERSION;
  readonly values: ReadonlyMap<number, Buffer>;
}

export class WebhookConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookConfigurationError";
  }
}

export function loadWebhookEncryptionKeySet(values: Readonly<Record<string, string | undefined>> = process.env): WebhookEncryptionKeySet {
  const encoded = values.SETTLE_WEBHOOK_ENCRYPTION_KEY_V1?.trim();
  if (!encoded) throw new WebhookConfigurationError("SETTLE_WEBHOOK_ENCRYPTION_KEY_V1 is required");
  let key: Buffer;
  try { key = Buffer.from(encoded, "base64"); }
  catch { throw new WebhookConfigurationError("SETTLE_WEBHOOK_ENCRYPTION_KEY_V1 must be base64"); }
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new WebhookConfigurationError("SETTLE_WEBHOOK_ENCRYPTION_KEY_V1 must encode exactly 32 bytes");
  }
  return { currentVersion: WEBHOOK_SECRET_VERSION, values: new Map([[WEBHOOK_SECRET_VERSION, key]]) };
}

export function generateWebhookSigningSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

export function encryptWebhookSigningSecret(secret: string, keys: WebhookEncryptionKeySet, version = keys.currentVersion): string {
  const key = keys.values.get(version);
  if (!key) throw new WebhookConfigurationError(`Webhook encryption key version ${version} is unavailable`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(ENCRYPTION_AAD);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${version}.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptWebhookSigningSecret(value: string, keys: WebhookEncryptionKeySet): string {
  const match = /^v([1-9][0-9]*)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!match) throw new WebhookConfigurationError("Webhook signing secret ciphertext is malformed");
  const version = Number(match[1]);
  const key = keys.values.get(version);
  if (!key) throw new WebhookConfigurationError(`Webhook encryption key version ${version} is unavailable`);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(match[2]!, "base64url"));
    decipher.setAAD(ENCRYPTION_AAD);
    decipher.setAuthTag(Buffer.from(match[4]!, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(match[3]!, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new WebhookConfigurationError("Webhook signing secret could not be decrypted");
  }
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Webhook payload numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  throw new TypeError("Webhook payload must contain JSON values only");
}

export function canonicalWebhookJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function webhookPayloadHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function createWebhookSignature(secret: string, timestamp: number, rawBody: string): string {
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new RangeError("Webhook signature timestamp is invalid");
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function createWebhookSignatureHeader(secret: string, timestamp: number, rawBody: string): string {
  return `t=${timestamp},v1=${createWebhookSignature(secret, timestamp, rawBody)}`;
}

export function verifyWebhookSignatureHeader(secret: string, header: string, rawBody: string, nowSeconds: number, toleranceSeconds: number): boolean {
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 1) return false;
  const match = /^t=([0-9]+),v1=([0-9a-f]{64})$/.exec(header);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(createWebhookSignature(secret, timestamp, rawBody), "hex");
  const received = Buffer.from(match[2]!, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function parseIpv4(value: string): readonly number[] | undefined {
  if (isIP(value) !== 4) return undefined;
  const parts = value.split(".").map(Number);
  return parts.length === 4 ? parts : undefined;
}

export function isForbiddenWebhookAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const ipv4 = parseIpv4(normalized);
  if (ipv4) {
    const [a, b, c] = ipv4;
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a! >= 224;
  }
  if (isIP(normalized) !== 6) return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return isForbiddenWebhookAddress(mapped[1]!);
  return normalized === "::" || normalized === "::1" ||
    /^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized) || /^ff/.test(normalized) ||
    /^2001:db8(?::|$)/.test(normalized) || /^2001:(?:10|20)(?::|$)/.test(normalized) ||
    /^64:ff9b:1(?::|$)/.test(normalized);
}

export function validateWebhookEndpointUrl(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > MAX_ENDPOINT_URL_BYTES) throw new RangeError("Webhook endpoint URL must contain at most 2048 bytes");
  let url: URL;
  try { url = new URL(value); }
  catch { throw new RangeError("Webhook endpoint URL must be valid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) {
    throw new RangeError("Webhook endpoint URL must use HTTPS on port 443 without credentials or fragments");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new RangeError("Webhook endpoint hostname is not allowed");
  }
  if (isIP(hostname) && isForbiddenWebhookAddress(hostname)) throw new RangeError("Webhook endpoint IP address is not allowed");
  url.hostname = hostname;
  if (url.port === "443") url.port = "";
  return url.toString();
}

export function validateWebhookSubscriptions(value: unknown): readonly WebhookEventType[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16 || new Set(value).size !== value.length || value.some((entry) => typeof entry !== "string" || !WEBHOOK_EVENT_TYPES.includes(entry as WebhookEventType))) {
    throw new RangeError("Webhook subscriptions must be a unique non-empty subset of supported event types");
  }
  return [...value].sort() as WebhookEventType[];
}

export function classifyWebhookResponse(status: number | undefined, failureCode?: string): "delivered" | "retryable_failure" | "terminal_failure" {
  if (failureCode) return ["network_error", "timeout", "dns_error"].includes(failureCode) ? "retryable_failure" : "terminal_failure";
  if (status !== undefined && status >= 200 && status < 300) return "delivered";
  if (status === 408 || status === 429 || (status !== undefined && status >= 500)) return "retryable_failure";
  return "terminal_failure";
}

export function webhookRetryDelaySeconds(attemptNumber: number, deliveryId: string): number {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) throw new RangeError("Webhook attempt number must be positive");
  const base = Math.min(6 * 60 * 60, 30 * 2 ** Math.min(attemptNumber - 1, 10));
  const byte = createHash("sha256").update(`${deliveryId}:${attemptNumber}`).digest()[0]!;
  const jitter = 0.8 + (byte / 255) * 0.4;
  return Math.max(1, Math.round(base * jitter));
}
