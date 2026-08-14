import "server-only";

import { randomUUID } from "node:crypto";
import { MerchantApiKeyAuthError, MerchantApiKeyService, type AuthenticatedMerchantApiKey } from "@settle/db/api-key-service";
import { loadApiKeyPepperSet, type ApiKeyScope } from "@settle/db/api-keys";
import { MerchantPaymentIntentError } from "@settle/db/payment-intent-service";
import { PersistentRateLimitError, PersistentRateLimitService, type RateLimitRouteGroup } from "@settle/db/rate-limit-service";

import { getWebDatabase } from "../auth/merchant-store.server.ts";

const MAX_JSON_BODY_BYTES = 32 * 1024;

export type MerchantApiRequestContext = Readonly<{
  auth: AuthenticatedMerchantApiKey;
  requestId: string;
  auditRequestId: string;
  rateLimit: Readonly<{ limit: number; remaining: number; resetAt: Date }>;
}>;

function trustedRequestIp(request: Request) {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  if (process.env.NODE_ENV !== "production") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return undefined;
}

export async function authorizeMerchantApiRequest(request: Request, requiredScope: ApiKeyScope, routeGroup: RateLimitRouteGroup): Promise<MerchantApiRequestContext> {
  const auditRequestId = randomUUID();
  const peppers = loadApiKeyPepperSet(process.env);
  const auth = await new MerchantApiKeyService(getWebDatabase(), peppers).authenticateAuthorizationHeader(request.headers.get("authorization"), requiredScope);
  const digestKey = peppers.values.get(peppers.currentVersion);
  if (!digestKey) throw new Error("Current API key pepper version is unavailable");
  const rateLimit = await new PersistentRateLimitService(getWebDatabase(), digestKey).consumeRequest({ ...auth, routeGroup, ip: trustedRequestIp(request) });
  return { auth, requestId: `req_${auditRequestId}`, auditRequestId, rateLimit };
}

export async function readBoundedJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new MerchantPaymentIntentError(400, "invalid_content_type", "Content-Type must be application/json", "Content-Type");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) throw new MerchantPaymentIntentError(400, "request_body_too_large", `Request body must not exceed ${MAX_JSON_BODY_BYTES} bytes`);
  if (!request.body) throw new MerchantPaymentIntentError(400, "invalid_json", "A JSON request body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_JSON_BODY_BYTES) {
      await reader.cancel();
      throw new MerchantPaymentIntentError(400, "request_body_too_large", `Request body must not exceed ${MAX_JSON_BODY_BYTES} bytes`);
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(body); }
  catch { throw new MerchantPaymentIntentError(400, "invalid_json", "Request body must be valid JSON"); }
}

export async function requireEmptyActivationBody(request: Request): Promise<void> {
  if (!request.body || request.headers.get("content-length") === "0") return;
  const body = await readBoundedJson(request);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as object).length !== 0) throw new MerchantPaymentIntentError(400, "activation_body_not_allowed", "Activation accepts no request fields");
}

export function merchantApiSuccess(body: Record<string, unknown>, status: number, context: MerchantApiRequestContext, replayed = false) {
  return Response.json({ ...body, request_id: context.requestId }, {
    status,
    headers: {
      "x-request-id": context.requestId,
      "x-ratelimit-limit": String(context.rateLimit.limit),
      "x-ratelimit-remaining": String(context.rateLimit.remaining),
      "x-ratelimit-reset": context.rateLimit.resetAt.toISOString(),
      ...(replayed ? { "idempotent-replayed": "true" } : {}),
    },
  });
}

export function merchantApiError(cause: unknown, requestId = `req_${randomUUID()}`) {
  let status = 500;
  let type = "api_error";
  let code = "internal_error";
  let message = "The request could not be completed";
  let param: string | undefined;
  let retryAfter: number | undefined;
  if (cause instanceof MerchantApiKeyAuthError) {
    status = cause.status; type = "authentication_error"; code = cause.code; message = cause.message;
  } else if (cause instanceof PersistentRateLimitError) {
    status = 429; type = "rate_limit_error"; code = "rate_limit_exceeded"; message = cause.message; retryAfter = cause.retryAfterSeconds;
  } else if (cause instanceof MerchantPaymentIntentError) {
    status = cause.status; type = cause.status >= 500 ? "api_error" : "invalid_request_error"; code = cause.code; message = cause.message; param = cause.param;
  }
  return Response.json({ error: { type, code, message, ...(param ? { param } : {}) }, request_id: requestId }, { status, headers: { "x-request-id": requestId, ...(retryAfter ? { "retry-after": String(retryAfter) } : {}) } });
}
