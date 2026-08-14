import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_DIGEST_VERSION = 1 as const;
export const API_KEY_SCOPES = ["payment_intents:read", "payment_intents:write", "webhook_endpoints:read", "webhook_endpoints:write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const KEY_PATTERN = /^sk_test_([A-Za-z0-9_-]{22})_([A-Za-z0-9_-]{43})$/;
const MINIMUM_PEPPER_BYTES = 32;

export interface ApiKeyPepperSet {
  readonly currentVersion: typeof API_KEY_DIGEST_VERSION;
  readonly values: ReadonlyMap<number, string>;
}

export interface GeneratedApiKey {
  readonly plaintext: string;
  readonly keyId: string;
  readonly prefix: string;
  readonly secretDigest: string;
  readonly digestVersion: typeof API_KEY_DIGEST_VERSION;
}

export class ApiKeyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyConfigurationError";
  }
}

function validatePepper(value: string | undefined): string {
  const pepper = value?.trim();
  if (!pepper) throw new ApiKeyConfigurationError("SETTLE_API_KEY_PEPPER_V1 is required");
  if (Buffer.byteLength(pepper, "utf8") < MINIMUM_PEPPER_BYTES) {
    throw new ApiKeyConfigurationError(`SETTLE_API_KEY_PEPPER_V1 must contain at least ${MINIMUM_PEPPER_BYTES} bytes`);
  }
  return pepper;
}

export function loadApiKeyPepperSet(values: Readonly<Record<string, string | undefined>> = process.env): ApiKeyPepperSet {
  return {
    currentVersion: API_KEY_DIGEST_VERSION,
    values: new Map([[API_KEY_DIGEST_VERSION, validatePepper(values.SETTLE_API_KEY_PEPPER_V1)]]),
  };
}

export function parseApiKey(value: string): Readonly<{ keyId: string; secret: string }> | undefined {
  const match = KEY_PATTERN.exec(value);
  return match ? { keyId: match[1]!, secret: match[2]! } : undefined;
}

export function digestApiKey(plaintext: string, pepper: string): string {
  return createHmac("sha256", pepper).update(plaintext, "utf8").digest("hex");
}

export function generateApiKey(peppers: ApiKeyPepperSet): GeneratedApiKey {
  const keyId = randomBytes(16).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `sk_test_${keyId}_${secret}`;
  const pepper = peppers.values.get(peppers.currentVersion);
  if (!pepper) throw new ApiKeyConfigurationError("Current API key pepper version is unavailable");
  return {
    plaintext,
    keyId,
    prefix: `sk_test_${keyId}_${secret.slice(0, 8)}`,
    secretDigest: digestApiKey(plaintext, pepper),
    digestVersion: peppers.currentVersion,
  };
}

export function verifyApiKeyDigest(plaintext: string, expectedDigest: string, pepper: string): boolean {
  const actual = Buffer.from(digestApiKey(plaintext, pepper), "hex");
  const isExpectedDigest = /^[0-9a-f]{64}$/.test(expectedDigest);
  const expected = isExpectedDigest ? Buffer.from(expectedDigest, "hex") : Buffer.alloc(actual.length);
  return timingSafeEqual(actual, expected) && isExpectedDigest;
}

export function validateApiKeyScopes(scopes: readonly string[]): asserts scopes is readonly ApiKeyScope[] {
  if (scopes.length === 0 || new Set(scopes).size !== scopes.length || scopes.some((scope) => !API_KEY_SCOPES.includes(scope as ApiKeyScope))) {
    throw new RangeError("API key scopes must be a non-empty unique subset of the supported scopes");
  }
}

export function readBearerApiKey(header: string | null): string | undefined {
  if (!header) return undefined;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1];
}
