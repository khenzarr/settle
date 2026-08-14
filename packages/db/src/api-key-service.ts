import "server-only";

import { API_KEY_SCOPES, generateApiKey, parseApiKey, readBearerApiKey, validateApiKeyScopes, verifyApiKeyDigest, type ApiKeyPepperSet, type ApiKeyScope } from "./api-keys.ts";
import { AuditRepository, MerchantApiKeyRepository } from "./repositories/index.ts";
import type { DatabaseExecutor } from "./transaction.ts";
import type { TenantContext } from "./types.ts";

const DUMMY_KEY = `sk_test_${"A".repeat(22)}_${"B".repeat(43)}`;
const DUMMY_DIGEST = "0".repeat(64);

export class MerchantApiKeyAuthError extends Error {
  readonly code: "invalid_api_key" | "insufficient_scope";
  readonly status: 401 | 403;

  constructor(code: MerchantApiKeyAuthError["code"]) {
    super(code === "invalid_api_key" ? "API key authentication failed" : "API key lacks the required scope");
    this.name = "MerchantApiKeyAuthError";
    this.code = code;
    this.status = code === "invalid_api_key" ? 401 : 403;
  }
}

export interface AuthenticatedMerchantApiKey extends TenantContext {
  readonly apiKeyId: string;
  readonly scopes: readonly ApiKeyScope[];
}

export type ApiKeyLifecycleActor = Readonly<{
  type: "system" | "merchant_member";
  subject: string;
}>;

export interface IssueTestApiKeyInput extends TenantContext {
  readonly name: string;
  readonly scopes?: readonly ApiKeyScope[];
  readonly expiresAt?: Date;
  readonly createdByMemberId?: string;
  readonly actor: ApiKeyLifecycleActor;
}

export class MerchantApiKeyService {
  private readonly repository: MerchantApiKeyRepository;
  private readonly audit: AuditRepository;
  private readonly peppers: ApiKeyPepperSet;

  constructor(db: DatabaseExecutor, peppers: ApiKeyPepperSet) {
    this.repository = new MerchantApiKeyRepository(db);
    this.audit = new AuditRepository(db);
    this.peppers = peppers;
  }

  private async requireActiveTestEnvironment(tenant: TenantContext): Promise<void> {
    const environment = await this.repository.findTestEnvironment(tenant);
    if (!environment || environment.merchantStatus !== "active" || environment.environmentStatus !== "active" || environment.environmentKind !== "test") {
      throw new MerchantApiKeyAuthError("invalid_api_key");
    }
  }

  async issueTestKey(input: IssueTestApiKeyInput) {
    const name = input.name.trim();
    if (!name || name.length > 80) throw new RangeError("API key name must contain 1 to 80 characters");
    const scopes = input.scopes ?? API_KEY_SCOPES;
    validateApiKeyScopes(scopes);
    if (input.expiresAt && input.expiresAt <= new Date()) throw new RangeError("API key expiry must be in the future");
    if (input.actor.type === "merchant_member" && !input.createdByMemberId) throw new Error("Merchant-member key creation requires the local membership ID");
    await this.requireActiveTestEnvironment(input);

    const generated = generateApiKey(this.peppers);
    const record = await this.repository.create(input, {
      name,
      keyId: generated.keyId,
      prefix: generated.prefix,
      secretDigest: generated.secretDigest,
      digestVersion: generated.digestVersion,
      scopes,
      expiresAt: input.expiresAt,
      createdByMemberId: input.createdByMemberId,
    });
    await this.audit.appendForTenant(input, {
      actorType: input.actor.type,
      actorSubject: input.actor.subject,
      action: "merchant.api_key.created",
      resourceType: "merchant_api_key",
      resourceId: record.id,
      metadataJson: { prefix: record.prefix, scopes: record.scopes, digestVersion: generated.digestVersion, expiresAt: record.expiresAt?.toISOString() },
    });
    return { ...record, plaintext: generated.plaintext } as const;
  }

  async listTestKeys(tenant: TenantContext) {
    await this.requireActiveTestEnvironment(tenant);
    return this.repository.list(tenant);
  }

  async revokeTestKey(input: TenantContext & Readonly<{ apiKeyId: string; actor: ApiKeyLifecycleActor }>, now = new Date()) {
    await this.requireActiveTestEnvironment(input);
    const revoked = await this.repository.revoke(input, input.apiKeyId, now);
    if (!revoked) return undefined;
    await this.audit.appendForTenant(input, {
      actorType: input.actor.type,
      actorSubject: input.actor.subject,
      action: "merchant.api_key.revoked",
      resourceType: "merchant_api_key",
      resourceId: revoked.id,
      metadataJson: { revokedAt: revoked.revokedAt?.toISOString() },
    });
    return revoked;
  }

  async authenticateAuthorizationHeader(header: string | null, requiredScope: ApiKeyScope, now = new Date()): Promise<AuthenticatedMerchantApiKey> {
    const plaintext = readBearerApiKey(header);
    const parsed = plaintext ? parseApiKey(plaintext) : undefined;
    const candidate = parsed ? await this.repository.findAuthenticationContext(parsed.keyId) : undefined;
    const candidatePepper = candidate ? this.peppers.values.get(candidate.digestVersion) : undefined;
    const pepper = candidatePepper ?? this.peppers.values.get(this.peppers.currentVersion);
    if (!pepper) throw new Error("Current API key pepper version is unavailable");

    const digestMatches = verifyApiKeyDigest(plaintext ?? DUMMY_KEY, candidate?.secretDigest ?? DUMMY_DIGEST, pepper);
    if (!parsed || !candidate || !candidatePepper || !digestMatches || candidate.revokedAt || (candidate.expiresAt && candidate.expiresAt <= now) || candidate.merchantStatus !== "active" || candidate.environmentStatus !== "active" || candidate.environmentKind !== "test") {
      throw new MerchantApiKeyAuthError("invalid_api_key");
    }

    try { validateApiKeyScopes(candidate.scopesJson); }
    catch { throw new MerchantApiKeyAuthError("invalid_api_key"); }
    if (!candidate.scopesJson.includes(requiredScope)) throw new MerchantApiKeyAuthError("insufficient_scope");
    if (!await this.repository.markUsed(candidate.id, now)) throw new MerchantApiKeyAuthError("invalid_api_key");
    return { merchantId: candidate.merchantId, environmentId: candidate.environmentId, apiKeyId: candidate.id, scopes: candidate.scopesJson };
  }
}
